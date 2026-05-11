import { VIBE_GENRE_IDS, normalizeMoodKey } from "@/config/moodMappings";
import {
  conflictMessage,
  detectConflict,
  LIGHT_DARK_BRIDGE_IDS,
} from "@/config/recommendationSignals";
import { TMDB_GENRE_BY_ID } from "@/config/tmdbGenres";
import {
  discoverMovies,
  getMovieDetails,
  type DiscoverResponse,
} from "@/lib/tmdb/client";
import type {
  FinderMeta,
  RecommendedMovie,
  RecommendationReason,
} from "@/types/movie";
import type { RecommendationInput } from "./schema";

type DiscoverMovie = DiscoverResponse["results"][number];

function uniq(ids: number[]) {
  return [...new Set(ids.filter(Boolean))];
}


function yearFromDate(release_date: string) {
  if (!release_date || release_date.length < 4) return null;
  const y = Number(release_date.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

function movieMatchesPickedGenres(
  movieGenreIds: number[] | undefined,
  picked: number[],
  mode: "all" | "any",
): boolean {
  const g = movieGenreIds ?? [];
  if (!picked.length) return true;
  if (mode === "all") return picked.every((id) => g.includes(id));
  return picked.some((id) => g.includes(id));
}

function pickedGenreNames(picked: number[]) {
  return picked.map((id) => TMDB_GENRE_BY_ID[id] ?? `#${id}`).join(", ");
}

/**
 * Composite scoring: balances genre-fit, vibe-fit, and quality.
 * In conflict mode, dual-tagged bridge films get an extra boost.
 */
function compositeScore(
  m: DiscoverMovie,
  opts: {
    pickedGenres: number[];
    vibeGenreIds: number[];
    bridgeIds: number[];
    conflictMode: boolean;
  },
): number {
  const gids = m.genre_ids ?? [];
  const vote = m.vote_average ?? 0;
  const pop = m.popularity ?? 0;

  // Genre fit: fraction of picked genres present in the movie.
  const genreFit =
    opts.pickedGenres.length > 0
      ? opts.pickedGenres.filter((id) => gids.includes(id)).length /
        opts.pickedGenres.length
      : 0.5;

  // Vibe fit: fraction of vibe genres present in this movie.
  const vibeFit =
    opts.vibeGenreIds.length > 0
      ? opts.vibeGenreIds.filter((id) => gids.includes(id)).length /
        Math.max(opts.vibeGenreIds.length, 1)
      : 0.5;

  // Quality: balance rating and popularity equally.
  const qualityScore = vote * 1.4 + Math.log1p(pop) * 0.22;

  // Bridge bonus: movie has both a picked genre AND a bridge genre (dual-tag).
  const hasBridge = opts.bridgeIds.some((id) => gids.includes(id));
  const bridgeBonus =
    opts.conflictMode && hasBridge && genreFit > 0 ? 3.0 : 0;

  const genreWeight = opts.conflictMode ? 2.5 : 3.0;
  const vibeWeight = opts.conflictMode ? 2.0 : 1.5;
  const qualityWeight = 1.0;

  return (
    genreWeight * genreFit +
    vibeWeight * vibeFit +
    qualityWeight * qualityScore +
    bridgeBonus
  );
}

function buildReasons(
  input: RecommendationInput,
  movieGenreIds: number[],
  vibeGenreIds: number[],
  opts: {
    genreLock: boolean;
    pickedGenres: number[];
    pickedGenreMode: "all" | "any";
    conflictMode: boolean;
  },
): RecommendationReason[] {
  const reasons: RecommendationReason[] = [];

  if (opts.genreLock && opts.pickedGenres.length) {
    const modeLabel =
      opts.pickedGenreMode === "all" ? "match all" : "match at least one";
    reasons.push({
      label: `Genres: ${pickedGenreNames(opts.pickedGenres)} (${modeLabel})`,
      kind: "genre",
    });
  }

  if (input.vibes.length) {
    const vibeLabel = input.vibes.map((v) => v.trim()).filter(Boolean).join(", ");
    const vibeOverlap = movieGenreIds.filter((id) =>
      vibeGenreIds.includes(id),
    ).length;
    if (!opts.genreLock || vibeOverlap > 0) {
      reasons.push({
        label: `Vibes: ${vibeLabel}`,
        kind: "vibe",
      });
    }
  }

  if (opts.conflictMode) {
    reasons.push({
      label: "Best fit for mixed preferences",
      kind: "conflict",
    });
  }

  if (input.streamingOnly) {
    reasons.push({ label: "Streaming availability filter" });
  }

  return reasons.slice(0, 5);
}

async function discoverPages(
  baseParams: URLSearchParams,
  maxPages: number,
): Promise<DiscoverMovie[]> {
  const merged: DiscoverMovie[] = [];
  const seen = new Set<number>();

  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams(baseParams);
    params.set("page", String(page));
    const data = await discoverMovies(params);
    for (const r of data.results) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        merged.push(r);
      }
    }
    if (!data.results.length || page >= (data.total_pages ?? 1)) break;
  }
  return merged;
}

export type EngineResult = {
  movies: RecommendedMovie[];
  finderMeta: FinderMeta;
};

export async function runRecommendationEngine(
  input: RecommendationInput,
  excludeTmdbIds: Set<number>,
): Promise<EngineResult> {
  const userPicked = uniq(input.genres ?? []);
  const genreLock = userPicked.length > 0;

  const vibeKeys = input.vibes.map((v) => normalizeMoodKey(v));
  const hasNostalgic = vibeKeys.includes("nostalgic");

  // Always compute vibe genre pool.
  let vibeGenreIds: number[] = [];
  for (const k of vibeKeys) {
    vibeGenreIds.push(...(VIBE_GENRE_IDS[k] ?? []));
  }
  vibeGenreIds = uniq(vibeGenreIds);

  // Detect conflict: light vibes + dark genres with no overlap.
  const conflictMode = genreLock && detectConflict(vibeGenreIds, userPicked);

  const finderMeta: FinderMeta = {
    conflictDetected: conflictMode,
    userMessage: conflictMode
      ? conflictMessage(
          input.vibes,
          userPicked.map((id) => TMDB_GENRE_BY_ID[id] ?? `#${id}`),
        )
      : "",
  };

  // Build discover genre list.
  let discoverGenreIds: number[];

  if (!genreLock) {
    // Vibe-only: use the full vibe pool (OR query).
    discoverGenreIds = vibeGenreIds;
  } else if (conflictMode) {
    // Conflict: OR of user picks + bridge genres (comedy etc.) so dual-tagged
    // films like horror-comedies can surface.
    discoverGenreIds = uniq([...userPicked, ...LIGHT_DARK_BRIDGE_IDS]);
  } else {
    // Normal genre lock: use only user picks.
    discoverGenreIds = [...userPicked];
  }

  const params = new URLSearchParams();
  // 300 vote minimum: filters out statistically unreliable ratings that come
  // from a handful of votes (e.g. 9.2/10 from 66 people is meaningless).
  params.set("vote_count.gte", "300");
  params.set("vote_average.gte", String(input.minVoteAverage));
  params.set("include_adult", "false");

  if (discoverGenreIds.length) {
    params.set("with_genres", discoverGenreIds.join("|"));
  }
  params.set("sort_by", "popularity.desc");

  if (input.runtimeMin != null) {
    params.set("with_runtime.gte", String(input.runtimeMin));
  }
  if (input.runtimeMax != null) {
    params.set("with_runtime.lte", String(input.runtimeMax));
  }

  if (input.eraMinYear != null) {
    params.set("primary_release_date.gte", `${input.eraMinYear}-01-01`);
  }
  if (input.eraMaxYear != null) {
    params.set("primary_release_date.lte", `${input.eraMaxYear}-12-31`);
  } else if (hasNostalgic && !input.eraMaxYear) {
    params.set("primary_release_date.lte", "1999-12-31");
  }

  if (input.language) {
    params.set("with_original_language", input.language);
  }

  if (input.streamingOnly && input.watchRegion) {
    params.set("watch_region", input.watchRegion);
    params.set("with_watch_monetization_types", "flatrate");
  }

  // More pages for vibe-only queries: broader pool needed to find good matches.
  const maxPages = genreLock ? 6 : 5;
  const results = await discoverPages(params, maxPages);

  const baseFilter = (m: DiscoverMovie) =>
    m.id &&
    m.title &&
    !excludeTmdbIds.has(m.id) &&
    (m.vote_count ?? 0) >= 200;

  let filtered = results.filter(baseFilter);

  let pickedGenreMode: "all" | "any" = "any";

  if (genreLock && !conflictMode) {
    // Strict genre lock: prefer all-match, fall back to any-match.
    const strictList = filtered.filter((m) =>
      movieMatchesPickedGenres(m.genre_ids, userPicked, "all"),
    );
    if (strictList.length > 0) {
      filtered = strictList;
      pickedGenreMode = "all";
    } else {
      filtered = filtered.filter((m) =>
        movieMatchesPickedGenres(m.genre_ids, userPicked, "any"),
      );
      pickedGenreMode = "any";
    }
  } else if (genreLock && conflictMode) {
    // Conflict mode: require at least one user-picked genre (avoids pure-comedy drift).
    filtered = filtered.filter((m) =>
      movieMatchesPickedGenres(m.genre_ids, userPicked, "any"),
    );
    pickedGenreMode = "any";
  }

  // Composite scoring.
  const bridgeIds = conflictMode ? LIGHT_DARK_BRIDGE_IDS : [];
  const scored = filtered
    .map((m) => ({
      m,
      s: compositeScore(m, {
        pickedGenres: userPicked,
        vibeGenreIds,
        bridgeIds,
        conflictMode,
      }),
    }))
    .sort((a, b) => b.s - a.s);

  const uniqueById = new Map<number, DiscoverMovie>();
  for (const { m } of scored) {
    if (!uniqueById.has(m.id)) uniqueById.set(m.id, m);
  }

  // Fetch up to 16 candidates for detail hydration; final list trimmed to 8.
  const top = [...uniqueById.values()].slice(0, 16);

  const detailed = await Promise.all(
    top.map(async (m) => {
      try {
        const d = await getMovieDetails(m.id);
        return { summary: m, details: d };
      } catch {
        return { summary: m, details: null };
      }
    }),
  );

  const out: RecommendedMovie[] = [];

  for (const { summary, details } of detailed) {
    if (out.length >= 8) break;

    const src = details ?? summary;
    const genreIdsList =
      details?.genres?.map((g) => g.id) ?? summary.genre_ids ?? [];

    // Final genre check after detail resolution.
    if (genreLock && !conflictMode) {
      if (!movieMatchesPickedGenres(genreIdsList, userPicked, pickedGenreMode)) {
        continue;
      }
    } else if (genreLock && conflictMode) {
      if (!movieMatchesPickedGenres(genreIdsList, userPicked, "any")) {
        continue;
      }
    }

    const reasons = buildReasons(input, genreIdsList, vibeGenreIds, {
      genreLock,
      pickedGenres: userPicked,
      pickedGenreMode,
      conflictMode,
    });

    out.push({
      id: src.id,
      title: src.title,
      overview: src.overview,
      poster_path: src.poster_path,
      backdrop_path: src.backdrop_path,
      release_date:
        "release_date" in src ? src.release_date : summary.release_date,
      vote_average: src.vote_average,
      vote_count: src.vote_count,
      popularity: src.popularity,
      genre_ids: genreIdsList,
      runtime: details?.runtime ?? null,
      release_year: yearFromDate(
        "release_date" in src ? src.release_date : summary.release_date,
      ),
      reasons,
    });
  }

  return { movies: out, finderMeta };
}
