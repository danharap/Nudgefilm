/**
 * Personalised movie recommendations derived from the user's recent diary.
 *
 * Algorithm overview:
 *   1. Fetch last 30 movie (not TV) diary entries with genres + ratings.
 *   2. Assign each entry a *weight* = recency_score × rating_score.
 *      - Recency uses exponential decay (half-life 45 days).
 *      - Rating: <3 → zero weight; unrated → 0.3; 10 → 1.0.
 *   3. Sum weights per TMDb genre → genreWeights map.
 *   4. Discover movies from TMDb using the top 4 weighted genres.
 *      Also fetch /similar for the top 2 source movies ("Because you watched X").
 *      Add 1-2 exploration picks from adjacent (next-tier) genres.
 *   5. Score candidates: 65 % genre-fit + 35 % quality (vote_average).
 *   6. Hydrate top 12 candidates with full details; return top 10 with reasons.
 */

import { createClient } from "@/lib/supabase/server";
import {
  discoverMovies,
  getMovieDetails,
  getSimilarMovies,
} from "@/lib/tmdb/client";
import { TMDB_GENRE_BY_ID } from "@/config/tmdbGenres";
import { TV_TMDB_OFFSET } from "@/lib/tmdb/constants";
import type { RecommendedMovie, RecommendationReason } from "@/types/movie";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TasteProfile = {
  /** genre_id → cumulative recency×rating weight */
  genreWeights: Map<number, number>;
  /** All movie TMDb IDs the user has logged (TV excluded) */
  allWatchedTmdbIds: Set<number>;
  /** Top source movies by weight — drives "Because you watched X" labels */
  topSourceMovies: Array<{
    title: string;
    tmdbId: number;
    genreIds: number[];
    weight: number;
  }>;
  /** Number of diary entries examined */
  totalEntries: number;
};

type WatchedRow = {
  user_rating: number | null;
  watched_at: string | null;
  movies:
    | { tmdb_id: number; title: string; genres: Array<{ id: number; name: string }> | null }
    | Array<{ tmdb_id: number; title: string; genres: Array<{ id: number; name: string }> | null }>
    | null;
};

type DiscoverMovie = {
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
};

// ─── Scoring helpers ──────────────────────────────────────────────────────────

/** Exponential decay — movies watched ~45 days ago get half the recency score. */
function recencyScore(watchedAt: string | null): number {
  if (!watchedAt) return 0.2;
  const days = (Date.now() - new Date(watchedAt).getTime()) / 86_400_000;
  return Math.exp((-days * Math.LN2) / 45);
}

/**
 * Rating influence:
 *  < 3   → 0   (disliked — no positive signal)
 *  null  → 0.3 (unrated — mild influence)
 *  4     → 0.14 … 10 → 1.0
 */
function ratingScore(rating: number | null): number {
  if (rating == null) return 0.3;
  if (rating < 3) return 0;
  return (rating - 3) / 7;
}

function pickTopGenreIds(weights: Map<number, number>, limit: number): number[] {
  return [...weights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}

function releaseYear(rd: string | undefined | null): number | null {
  if (!rd || rd.length < 4) return null;
  const y = Number(rd.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

// ─── Core services ────────────────────────────────────────────────────────────

/**
 * Build a weighted taste profile from the user's recent diary.
 * Exported so the blend service can reuse it for any user ID.
 */
export async function buildUserTasteProfile(userId: string): Promise<TasteProfile> {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("watched_movies")
    .select(
      "user_rating, watched_at, movies!watched_movies_movie_id_fkey(tmdb_id, title, genres)",
    )
    .eq("user_id", userId)
    .order("watched_at", { ascending: false })
    .limit(30);

  const genreWeights = new Map<number, number>();
  const allWatchedTmdbIds = new Set<number>();
  const sourceMovies: TasteProfile["topSourceMovies"] = [];

  for (const raw of (rows ?? []) as WatchedRow[]) {
    const movie = Array.isArray(raw.movies) ? raw.movies[0] : raw.movies;
    if (!movie) continue;

    const tmdbId = Number(movie.tmdb_id);
    if (!Number.isFinite(tmdbId) || tmdbId >= TV_TMDB_OFFSET) continue;

    allWatchedTmdbIds.add(tmdbId);

    const w = recencyScore(raw.watched_at) * ratingScore(raw.user_rating);
    if (w <= 0) continue;

    const genres = (movie.genres ?? []) as Array<{ id: number; name: string }>;
    const genreIds = genres.map((g) => Number(g.id)).filter(Number.isFinite);
    for (const gid of genreIds) {
      genreWeights.set(gid, (genreWeights.get(gid) ?? 0) + w);
    }
    sourceMovies.push({ title: movie.title, tmdbId, genreIds, weight: w });
  }

  return {
    genreWeights,
    allWatchedTmdbIds,
    topSourceMovies: sourceMovies.sort((a, b) => b.weight - a.weight).slice(0, 5),
    totalEntries: (rows ?? []).length,
  };
}

function buildPersonalizedReasons(
  genreIds: number[],
  genreWeights: Map<number, number>,
  topSourceMovies: TasteProfile["topSourceMovies"],
  isExploration: boolean,
): RecommendationReason[] {
  const reasons: RecommendationReason[] = [];

  if (isExploration) {
    reasons.push({ label: "Something a little different", kind: "vibe" });
  }

  // "Because you watched X"
  const source = topSourceMovies.find((s) =>
    s.genreIds.some((g) => genreIds.includes(g)),
  );
  if (source) {
    reasons.push({ label: `Because you watched ${source.title}`, kind: "vibe" });
  }

  // Top matching genre
  const topGenreEntry = [...genreWeights.entries()]
    .filter(([id]) => genreIds.includes(id))
    .sort((a, b) => b[1] - a[1])[0];
  if (topGenreEntry) {
    const name = TMDB_GENRE_BY_ID[topGenreEntry[0]];
    if (name) reasons.push({ label: `More ${name}`, kind: "genre" });
  }

  return reasons.slice(0, 3);
}

/**
 * Return up to 10 personalised movie recommendations for a user.
 * Returns an empty list if the user has < 3 diary entries.
 */
export async function getPersonalizedRecommendations(userId: string): Promise<{
  movies: RecommendedMovie[];
  tasteProfile: TasteProfile;
}> {
  const tasteProfile = await buildUserTasteProfile(userId);

  if (tasteProfile.totalEntries < 3 || tasteProfile.genreWeights.size === 0) {
    return { movies: [], tasteProfile };
  }

  const topGenres = pickTopGenreIds(tasteProfile.genreWeights, 4);
  const explorationGenres = pickTopGenreIds(tasteProfile.genreWeights, 7).slice(5);
  const maxWeight = Math.max(...tasteProfile.genreWeights.values(), 1);

  // ── Primary discover (top taste genres, 2 pages) ──────────────────────────
  const baseParams = new URLSearchParams({
    with_genres: topGenres.join("|"),
    sort_by: "popularity.desc",
    "vote_count.gte": "50",
    "vote_average.gte": "5.5",
    include_adult: "false",
  });

  const [p1, p2] = await Promise.all([
    discoverMovies(baseParams).catch(() => ({ results: [] as DiscoverMovie[] })),
    (() => {
      const p = new URLSearchParams(baseParams);
      p.set("page", "2");
      return discoverMovies(p).catch(() => ({ results: [] as DiscoverMovie[] }));
    })(),
  ]);

  // ── TMDb /similar for top 2 source movies ────────────────────────────────
  const similarAll: DiscoverMovie[] = [];
  for (const src of tasteProfile.topSourceMovies.slice(0, 2)) {
    try {
      const { results } = await getSimilarMovies(src.tmdbId);
      similarAll.push(...(results as DiscoverMovie[]));
    } catch {
      // network hiccup — skip gracefully
    }
  }

  // ── Exploration: adjacent genre tier ─────────────────────────────────────
  let explorationResults: DiscoverMovie[] = [];
  if (explorationGenres.length > 0) {
    const ep = new URLSearchParams({
      with_genres: explorationGenres.join("|"),
      sort_by: "vote_average.desc",
      "vote_count.gte": "100",
      include_adult: "false",
    });
    explorationResults = await discoverMovies(ep)
      .then((r) => r.results as DiscoverMovie[])
      .catch(() => []);
  }

  // ── Merge & dedup ─────────────────────────────────────────────────────────
  const seen = new Set<number>();
  const mainCandidates: DiscoverMovie[] = [];
  for (const m of [...p1.results, ...p2.results, ...similarAll]) {
    if (!seen.has(m.id)) { seen.add(m.id); mainCandidates.push(m); }
  }
  const explorationCandidates: (DiscoverMovie & { isExploration: true })[] = [];
  for (const m of explorationResults) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      explorationCandidates.push({ ...m, isExploration: true });
    }
  }

  const scoreM = (m: DiscoverMovie) => {
    const gids = m.genre_ids ?? [];
    const genreFit =
      gids.reduce((s, gid) => s + (tasteProfile.genreWeights.get(gid) ?? 0), 0) /
      (maxWeight * Math.max(gids.length, 1));
    return 0.65 * genreFit + 0.35 * ((m.vote_average ?? 0) / 10);
  };

  const filteredMain = mainCandidates
    .filter((m) => !tasteProfile.allWatchedTmdbIds.has(m.id) && (m.vote_count ?? 0) >= 30)
    .map((m) => ({ m, score: scoreM(m), isExploration: false as const }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 13);

  const filteredExploration = explorationCandidates
    .filter((m) => !tasteProfile.allWatchedTmdbIds.has(m.id) && (m.vote_count ?? 0) >= 50)
    .map((m) => ({ m, score: scoreM(m), isExploration: true as const }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const candidates = [...filteredMain, ...filteredExploration].slice(0, 14);

  // ── Hydrate with full details ─────────────────────────────────────────────
  const hydrated = await Promise.all(
    candidates.slice(0, 12).map(async ({ m, isExploration }) => {
      try {
        const d = await getMovieDetails(m.id);
        return { summary: m, details: d, isExploration };
      } catch {
        return { summary: m, details: null, isExploration };
      }
    }),
  );

  const movies: RecommendedMovie[] = [];
  for (const { summary, details, isExploration } of hydrated) {
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
      release_year: releaseYear(rd),
      reasons: buildPersonalizedReasons(
        genreIds,
        tasteProfile.genreWeights,
        tasteProfile.topSourceMovies,
        isExploration,
      ),
    });
  }

  return { movies, tasteProfile };
}
