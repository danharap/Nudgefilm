/**
 * Friend Blend — shared movie recommendations for two users.
 *
 * Algorithm:
 *   1. Build a TasteProfile for each user using buildUserTasteProfile().
 *   2. Blend the genre weight maps via geometric mean.
 *      Geometric mean naturally requires BOTH users to like a genre —
 *      one user's strong preference can't drag along genres the other dislikes.
 *   3. Discover movies from TMDb matching the top blended genres.
 *   4. Exclude any movie watched by EITHER user.
 *   5. Score candidates: 65 % blended genre-fit + 35 % quality.
 *   6. Return top 10 movies with reasons explaining the shared taste fit.
 *
 * Privacy:
 *   The Supabase client respects RLS. Another user's watched_movies are
 *   readable only when their profiles.is_public = true (watched_select_public_profile).
 *   If the friend's diary is inaccessible, totalEntries will be 0 and
 *   getFriendBlendRecommendations returns privacyBlocked = true.
 */

import { createClient } from "@/lib/supabase/server";
import { discoverMovies, getMovieDetails } from "@/lib/tmdb/client";
import { TMDB_GENRE_BY_ID } from "@/config/tmdbGenres";
import type { RecommendedMovie, RecommendationReason } from "@/types/movie";
import { buildUserTasteProfile, type TasteProfile } from "./personalized";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BlendResult = {
  movies: RecommendedMovie[];
  sharedGenreNames: string[];
  userAProfile: TasteProfile;
  userBProfile: TasteProfile;
  privacyBlocked?: boolean;
  /** True if either user has too few diary entries for meaningful results. */
  insufficientData?: boolean;
};

// ─── Core blend logic ─────────────────────────────────────────────────────────

/**
 * Merge two genre weight maps using geometric mean.
 * Only genres present in BOTH maps with weight > 0 survive.
 */
export function blendTasteProfiles(
  profileA: TasteProfile,
  profileB: TasteProfile,
): Map<number, number> {
  const blended = new Map<number, number>();
  const maxA = Math.max(...profileA.genreWeights.values(), 1);
  const maxB = Math.max(...profileB.genreWeights.values(), 1);

  for (const [gid, wa] of profileA.genreWeights) {
    const wb = profileB.genreWeights.get(gid);
    if (wb == null || wb <= 0) continue;
    // Normalise each side to 0–1, then geometric mean
    blended.set(gid, Math.sqrt((wa / maxA) * (wb / maxB)));
  }
  return blended;
}

function buildBlendReasons(
  genreIds: number[],
  blendedWeights: Map<number, number>,
  profileA: TasteProfile,
  profileB: TasteProfile,
  friendName: string,
): RecommendationReason[] {
  const reasons: RecommendationReason[] = [];

  // Primary: top shared genre
  const topShared = [...blendedWeights.entries()]
    .filter(([id]) => genreIds.includes(id))
    .sort((a, b) => b[1] - a[1])[0];
  if (topShared) {
    const name = TMDB_GENRE_BY_ID[topShared[0]];
    if (name) reasons.push({ label: `You both love ${name}`, kind: "genre" });
  }

  // Cross-reference source movies
  const aSource = profileA.topSourceMovies.find((s) =>
    s.genreIds.some((g) => genreIds.includes(g)),
  );
  const bSource = profileB.topSourceMovies.find((s) =>
    s.genreIds.some((g) => genreIds.includes(g)),
  );
  if (aSource && bSource) {
    const sharedGenre = genreIds.find(
      (g) => aSource.genreIds.includes(g) && bSource.genreIds.includes(g),
    );
    const name = sharedGenre ? TMDB_GENRE_BY_ID[sharedGenre] : null;
    if (name) {
      reasons[0] = { label: `Shared taste in ${name}`, kind: "genre" };
      reasons.push({ label: `Neither of you has logged this`, kind: "quality" });
    }
  } else if (bSource) {
    reasons.push({ label: `Fits ${friendName}'s taste`, kind: "vibe" });
  }

  if (reasons.length < 2) {
    reasons.push({ label: `Neither of you has logged this`, kind: "quality" });
  }

  return reasons.slice(0, 3);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get blend recommendations for userId + friendId.
 * friendId must be a public profile for their diary to be accessible.
 */
export async function getFriendBlendRecommendations(
  userId: string,
  friendId: string,
): Promise<BlendResult> {
  // Build both taste profiles in parallel
  const [userAProfile, userBProfile] = await Promise.all([
    buildUserTasteProfile(userId),
    buildUserTasteProfile(friendId),
  ]);

  // RLS: friend's diary inaccessible → is_public = false
  if (userBProfile.totalEntries === 0) {
    return {
      movies: [],
      sharedGenreNames: [],
      userAProfile,
      userBProfile,
      privacyBlocked: true,
    };
  }

  if (userAProfile.totalEntries < 3 || userBProfile.totalEntries < 3) {
    return {
      movies: [],
      sharedGenreNames: [],
      userAProfile,
      userBProfile,
      insufficientData: true,
    };
  }

  const blendedWeights = blendTasteProfiles(userAProfile, userBProfile);

  if (blendedWeights.size === 0) {
    return { movies: [], sharedGenreNames: [], userAProfile, userBProfile };
  }

  // Top shared genre names for the UI summary
  const sharedGenreNames = [...blendedWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id]) => TMDB_GENRE_BY_ID[id])
    .filter(Boolean) as string[];

  const topGenres = [...blendedWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id]) => id);

  const excludedIds = new Set([
    ...userAProfile.allWatchedTmdbIds,
    ...userBProfile.allWatchedTmdbIds,
  ]);
  const maxBlend = Math.max(...blendedWeights.values(), 1);

  // Discover movies matching shared taste (2 pages)
  const params = new URLSearchParams({
    with_genres: topGenres.join("|"),
    sort_by: "popularity.desc",
    "vote_count.gte": "80",
    "vote_average.gte": "6.0",
    include_adult: "false",
  });

  const [p1, p2] = await Promise.all([
    discoverMovies(params).catch(() => ({ results: [] })),
    (() => {
      const p = new URLSearchParams(params);
      p.set("page", "2");
      return discoverMovies(p).catch(() => ({ results: [] }));
    })(),
  ]);

  const seen = new Set<number>();
  const candidates = [...p1.results, ...p2.results].filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return !excludedIds.has(m.id) && (m.vote_count ?? 0) >= 50;
  });

  const scored = candidates
    .map((m) => {
      const gids = m.genre_ids ?? [];
      const genreFit =
        gids.reduce((s, gid) => s + (blendedWeights.get(gid) ?? 0), 0) /
        (maxBlend * Math.max(gids.length, 1));
      return { m, score: 0.65 * genreFit + 0.35 * ((m.vote_average ?? 0) / 10) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  // Hydrate with full details
  const hydrated = await Promise.all(
    scored.map(async ({ m }) => {
      try {
        return { summary: m, details: await getMovieDetails(m.id) };
      } catch {
        return { summary: m, details: null };
      }
    }),
  );

  // Fetch friend name for reason labels
  const supabase = await createClient();
  const { data: fp } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", friendId)
    .maybeSingle();
  const friendName =
    (fp?.display_name as string | null)?.trim() ||
    (fp?.username as string | null) ||
    "your friend";

  const movies: RecommendedMovie[] = [];
  for (const { summary, details } of hydrated) {
    if (movies.length >= 10) break;
    const src = details ?? summary;
    const genreIds = details?.genres?.map((g) => g.id) ?? summary.genre_ids ?? [];
    const rd = "release_date" in src ? src.release_date : summary.release_date;

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
      release_year: (() => {
        if (!rd || rd.length < 4) return null;
        const y = Number(rd.slice(0, 4));
        return Number.isFinite(y) ? y : null;
      })(),
      reasons: buildBlendReasons(
        genreIds,
        blendedWeights,
        userAProfile,
        userBProfile,
        friendName,
      ),
    });
  }

  return { movies, sharedGenreNames, userAProfile, userBProfile };
}
