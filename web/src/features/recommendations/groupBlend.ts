/**
 * Blend Party — group movie recommendations for 2-5 users.
 *
 * Extends the two-user friend blend to support N participants.
 *
 * Algorithm:
 *   1. Build TasteProfile for each user in parallel.
 *   2. Blend genre weights using a modified geometric mean:
 *      - Normalize each user's weights to 0–1.
 *      - Users missing a genre contribute a small floor (0.05).
 *      - Apply a coverage multiplier: how many users actively have the genre.
 *      This rewards genres shared by most users without requiring unanimity.
 *   3. If the blended map is empty (all genres diverged), fall back to a
 *      simple average and flag the result as "diverse tastes".
 *   4. Discover movies from TMDb matching blended genres.
 *   5. Exclude movies already watched by ALL participants (prefer movies
 *      nobody has logged; penalise movies most have seen).
 *   6. Respect mature-content settings: if any participant has it disabled,
 *      filter out adult content.
 *   7. Return up to 10 movies with group-aware reason labels.
 */

import { createClient } from "@/lib/supabase/server";
import { discoverMovies, getMovieDetails } from "@/lib/tmdb/client";
import { TMDB_GENRE_BY_ID } from "@/config/tmdbGenres";
import { TV_TMDB_OFFSET } from "@/lib/tmdb/constants";
import type { RecommendedMovie, RecommendationReason } from "@/types/movie";
import { buildUserTasteProfile, type TasteProfile } from "./personalized";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GroupTasteProfile = {
  /** Blended genre weights across all participants. */
  blendedWeights: Map<number, number>;
  /** Top shared genre names for the summary UI. */
  sharedGenreNames: string[];
  /** Per-user taste profiles (for reason building). */
  userProfiles: Array<{ userId: string; displayName: string; profile: TasteProfile }>;
  /** TMDb IDs watched by every single participant (to exclude). */
  watchedByAll: Set<number>;
  /** TMDb IDs watched by at least one participant. */
  watchedByAny: Set<number>;
  /** True when tastes are very divergent and we fell back to average blending. */
  isDiverseTastes: boolean;
  /** True when adult content should be excluded (any user has it off). */
  excludeAdult: boolean;
};

export type GroupBlendResult = {
  movies: RecommendedMovie[];
  groupProfile: GroupTasteProfile;
  /** Returned when all profiles are private / inaccessible. */
  privacyBlocked?: boolean;
  /** Returned when the group doesn't have enough diary data. */
  insufficientData?: boolean;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

const FLOOR_WEIGHT = 0.05; // weight for users who don't have a genre

function normalise(weights: Map<number, number>): Map<number, number> {
  const max = Math.max(...weights.values(), 1);
  const out = new Map<number, number>();
  for (const [id, w] of weights) out.set(id, w / max);
  return out;
}

/**
 * Blend N taste profiles using a modified geometric mean.
 *
 * For each genre:
 *   - Gather each user's normalised weight (or FLOOR_WEIGHT if absent).
 *   - Compute geometric mean across all N users.
 *   - Multiply by (users_with_genre / N) as a coverage bonus.
 *     This ensures genres that only 1/5 users has still get down-weighted.
 */
function blendGroupProfiles(profiles: TasteProfile[]): Map<number, number> {
  const n = profiles.length;
  const normalised = profiles.map((p) => normalise(p.genreWeights));

  // Collect all genres present in at least one profile
  const allGenres = new Set<number>();
  for (const p of profiles) {
    for (const id of p.genreWeights.keys()) allGenres.add(id);
  }

  const blended = new Map<number, number>();

  for (const gid of allGenres) {
    let product = 1;
    let coverage = 0;
    for (const norm of normalised) {
      const w = norm.get(gid) ?? FLOOR_WEIGHT;
      product *= w;
      if ((norm.get(gid) ?? 0) > 0) coverage++;
    }
    const geomMean = Math.pow(product, 1 / n);
    const coverageRatio = coverage / n;
    blended.set(gid, geomMean * coverageRatio);
  }

  return blended;
}

/**
 * Fallback: arithmetic average of all genre weights (used when blended map is sparse).
 */
function averageGroupProfiles(profiles: TasteProfile[]): Map<number, number> {
  const n = profiles.length;
  const avg = new Map<number, number>();
  for (const p of profiles) {
    for (const [id, w] of p.genreWeights) {
      avg.set(id, (avg.get(id) ?? 0) + w / n);
    }
  }
  return avg;
}

// ─── Group taste profile builder ──────────────────────────────────────────────

/**
 * Build a merged taste profile for a group of users.
 * Fetches all individual profiles in parallel.
 */
export async function buildGroupTasteProfile(
  userIds: string[],
  displayNames: Map<string, string>,
  excludeAdult: boolean,
): Promise<GroupTasteProfile> {
  const profileResults = await Promise.all(
    userIds.map((id) => buildUserTasteProfile(id)),
  );

  const userProfiles = userIds.map((id, i) => ({
    userId: id,
    displayName: displayNames.get(id) ?? "Someone",
    profile: profileResults[i],
  }));

  // Combine all watched IDs
  const watchedSets = profileResults.map((p) => p.allWatchedTmdbIds);
  const watchedByAny = new Set<number>();
  for (const s of watchedSets) for (const id of s) watchedByAny.add(id);

  const watchedByAll = new Set<number>();
  for (const tmdbId of watchedByAny) {
    if (watchedSets.every((s) => s.has(tmdbId))) watchedByAll.add(tmdbId);
  }

  // Blend weights
  let blendedWeights = blendGroupProfiles(profileResults);

  // Drop near-zero entries
  const threshold = 0.001;
  for (const [id, w] of blendedWeights) {
    if (w < threshold) blendedWeights.delete(id);
  }

  let isDiverseTastes = false;
  if (blendedWeights.size < 2) {
    // Fall back to simple average — tastes are quite divergent
    blendedWeights = averageGroupProfiles(profileResults);
    isDiverseTastes = true;
  }

  const sharedGenreNames = [...blendedWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => TMDB_GENRE_BY_ID[id])
    .filter(Boolean) as string[];

  return {
    blendedWeights,
    sharedGenreNames,
    userProfiles,
    watchedByAll,
    watchedByAny,
    isDiverseTastes,
    excludeAdult,
  };
}

// ─── Reason builder ───────────────────────────────────────────────────────────

function buildGroupReasons(
  genreIds: number[],
  groupProfile: GroupTasteProfile,
): RecommendationReason[] {
  const { blendedWeights, userProfiles, watchedByAny, isDiverseTastes } = groupProfile;
  const reasons: RecommendationReason[] = [];
  const n = userProfiles.length;

  if (isDiverseTastes) {
    reasons.push({ label: "A good middle ground for your group", kind: "vibe" });
  }

  // How many users actively enjoy this genre
  const topMatchingGenre = [...blendedWeights.entries()]
    .filter(([id]) => genreIds.includes(id))
    .sort((a, b) => b[1] - a[1])[0];

  if (topMatchingGenre) {
    const genreName = TMDB_GENRE_BY_ID[topMatchingGenre[0]];
    if (genreName) {
      const usersWhoLikeIt = userProfiles.filter((up) =>
        (up.profile.genreWeights.get(topMatchingGenre[0]) ?? 0) > 0,
      ).length;

      if (usersWhoLikeIt === n) {
        reasons.push({ label: `Everyone in the group enjoys ${genreName}`, kind: "genre" });
      } else if (usersWhoLikeIt > 1) {
        reasons.push({
          label: `${usersWhoLikeIt} of you love ${genreName}`,
          kind: "genre",
        });
      } else {
        reasons.push({ label: `Strong ${genreName} match`, kind: "genre" });
      }
    }
  }

  // Not watched by anyone
  const tmdbIdsForGenres = genreIds;
  const isNew = !tmdbIdsForGenres.some((id) => watchedByAny.has(id));
  if (isNew || reasons.length < 2) {
    reasons.push({ label: "None of the group has logged this yet", kind: "quality" });
  }

  return reasons.slice(0, 3);
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Score a TMDb movie candidate against the group taste profile.
 *
 * Base score: 65% genre-fit + 35% quality.
 * Bonus: movies nobody in the group has watched get +0.1.
 * Penalty: movies most have already watched get -0.3.
 */
export function scoreCandidateForGroup(
  movie: {
    id: number;
    genre_ids: number[];
    vote_average: number;
  },
  groupProfile: GroupTasteProfile,
): number {
  const { blendedWeights, watchedByAll, watchedByAny } = groupProfile;
  const maxWeight = Math.max(...blendedWeights.values(), 1);
  const gids = movie.genre_ids ?? [];

  const genreFit =
    gids.reduce((s, gid) => s + (blendedWeights.get(gid) ?? 0), 0) /
    (maxWeight * Math.max(gids.length, 1));

  let score = 0.65 * genreFit + 0.35 * ((movie.vote_average ?? 0) / 10);

  if (!watchedByAny.has(movie.id)) score += 0.1;
  if (watchedByAll.has(movie.id)) score -= 0.3;

  return score;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate group blend recommendations for a Blend Party.
 *
 * @param partyId - The blend_party row ID.
 * @returns GroupBlendResult
 */
export async function getBlendPartyRecommendations(
  partyId: string,
): Promise<GroupBlendResult> {
  const supabase = await createClient();

  // Load party + members
  const { data: party } = await supabase
    .from("blend_parties")
    .select("id, creator_id, status, max_participants")
    .eq("id", partyId)
    .maybeSingle();

  if (!party) {
    return {
      movies: [],
      groupProfile: {
        blendedWeights: new Map(),
        sharedGenreNames: [],
        userProfiles: [],
        watchedByAll: new Set(),
        watchedByAny: new Set(),
        isDiverseTastes: false,
        excludeAdult: true,
      },
      insufficientData: true,
    };
  }

  const { data: members } = await supabase
    .from("blend_party_members")
    .select("user_id")
    .eq("party_id", partyId);

  const userIds = (members ?? []).map((m) => m.user_id as string);

  if (userIds.length < 2) {
    return {
      movies: [],
      groupProfile: {
        blendedWeights: new Map(),
        sharedGenreNames: [],
        userProfiles: [],
        watchedByAll: new Set(),
        watchedByAny: new Set(),
        isDiverseTastes: false,
        excludeAdult: true,
      },
      insufficientData: true,
    };
  }

  // Fetch profile display names + content prefs in parallel
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, display_name, username, show_mature_content")
    .in("id", userIds);

  const displayNames = new Map<string, string>();
  let excludeAdult = false;

  for (const p of profileRows ?? []) {
    const name =
      (p.display_name as string | null)?.trim() ||
      (p.username as string | null) ||
      "Someone";
    displayNames.set(p.id as string, name);
    // If any participant has mature content disabled, exclude it for the whole group
    if (!p.show_mature_content) excludeAdult = true;
  }

  // Build the group taste profile
  const groupProfile = await buildGroupTasteProfile(userIds, displayNames, excludeAdult);

  // Check if we have enough data
  const usersWithData = groupProfile.userProfiles.filter(
    (up) => up.profile.totalEntries >= 3,
  ).length;

  if (usersWithData < 2) {
    return { movies: [], groupProfile, insufficientData: true };
  }

  const { blendedWeights, watchedByAll } = groupProfile;

  if (blendedWeights.size === 0) {
    return { movies: [], groupProfile };
  }

  const topGenres = [...blendedWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id]) => id);

  // Discover candidates from TMDb (2 pages)
  const params = new URLSearchParams({
    with_genres: topGenres.join("|"),
    sort_by: "popularity.desc",
    "vote_count.gte": "80",
    "vote_average.gte": "6.0",
    include_adult: excludeAdult ? "false" : "false", // always false for group safety
  });

  const [p1, p2] = await Promise.all([
    discoverMovies(params).catch(() => ({ results: [] })),
    (() => {
      const p = new URLSearchParams(params);
      p.set("page", "2");
      return discoverMovies(p).catch(() => ({ results: [] }));
    })(),
  ]);

  // Bridge genre discovery when tastes are diverse (3rd page with different genre combo)
  let bridgeCandidates: Array<{
    id: number;
    title: string;
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    release_date: string;
    vote_average: number;
    vote_count: number;
    popularity: number;
    genre_ids: number[];
  }> = [];

  if (groupProfile.isDiverseTastes) {
    const bridgeGenres = [...blendedWeights.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(4, 8)
      .map(([id]) => id);
    if (bridgeGenres.length > 0) {
      const bp = new URLSearchParams({
        with_genres: bridgeGenres.join("|"),
        sort_by: "vote_average.desc",
        "vote_count.gte": "100",
        include_adult: "false",
      });
      bridgeCandidates = await discoverMovies(bp)
        .then((r) => r.results ?? [])
        .catch(() => []);
    }
  }

  const seen = new Set<number>();
  const allCandidates = [...p1.results, ...p2.results, ...bridgeCandidates].filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    // Exclude only movies watched by ALL participants (allow movies some haven't seen)
    return !watchedByAll.has(m.id) && (m.vote_count ?? 0) >= 50;
  });

  // Score and sort
  const scored = allCandidates
    .map((m) => ({
      m,
      score: scoreCandidateForGroup(
        { id: m.id, genre_ids: m.genre_ids ?? [], vote_average: m.vote_average ?? 0 },
        groupProfile,
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 14);

  // Hydrate top 12 with full details
  const hydrated = await Promise.all(
    scored.slice(0, 12).map(async ({ m }) => {
      try {
        return { summary: m, details: await getMovieDetails(m.id) };
      } catch {
        return { summary: m, details: null };
      }
    }),
  );

  const movies: RecommendedMovie[] = [];
  for (const { summary, details } of hydrated) {
    if (movies.length >= 10) break;
    const src = details ?? summary;
    const genreIds =
      details?.genres?.map((g: { id: number }) => g.id) ?? summary.genre_ids ?? [];
    const rd = "release_date" in src ? src.release_date : summary.release_date;

    const releaseYear = (() => {
      if (!rd || rd.length < 4) return null;
      const y = Number(rd.slice(0, 4));
      return Number.isFinite(y) ? y : null;
    })();

    movies.push({
      id: src.id,
      title: src.title,
      overview: src.overview,
      poster_path: src.poster_path,
      backdrop_path: src.backdrop_path,
      release_date: rd,
      vote_average: src.vote_average,
      vote_count: src.vote_count,
      popularity: src.popularity,
      genre_ids: genreIds,
      runtime: details?.runtime ?? null,
      release_year: releaseYear,
      reasons: buildGroupReasons(genreIds, groupProfile),
    });
  }

  // Skip movies watched by all participants (already excluded above, but also check for
  // movies where the TMDb ID clashes with TV offset)
  const filtered = movies.filter((m) => m.id < TV_TMDB_OFFSET);

  return { movies: filtered, groupProfile };
}
