import { movieDetailPath, tvDetailPath } from "@/lib/media-slug";

export const TMDB_API_BASE = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export function posterUrl(path: string | null, size: "w92" | "w342" | "w500" | "original" = "w500") {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

/**
 * TMDb movie IDs and TV IDs occupy the same numeric space and can collide.
 * We store TV entries in the shared `movies` table with a 10 million offset
 * so that tmdb_id 1399 (a movie) never conflicts with tv tmdb_id 1399 (e.g. GoT).
 * No DB schema change required.
 */
export const TV_TMDB_OFFSET = 10_000_000;
export const toTVStoredId = (tmdbId: number) => tmdbId + TV_TMDB_OFFSET;

/**
 * Individual TV seasons are stored with a 20 million offset applied to
 * the season's own TMDb ID (season.id from the show details response).
 * Season TMDb IDs never overlap with movie IDs (< 10M) or show IDs (10–20M range).
 */
export const TV_SEASON_OFFSET = 20_000_000;
export const toTVSeasonStoredId = (seasonTmdbId: number) => seasonTmdbId + TV_SEASON_OFFSET;

/** Browse/search cards key items by canonical TMDb id; DB rows may use offsets. Seasons are list-only/diary-only. */
export function browseCanonicalTmdbId(movieTmdbId: number): number | null {
  const id = Number(movieTmdbId);
  if (!Number.isFinite(id)) return null;
  if (id >= TV_SEASON_OFFSET) return null;
  if (id >= TV_TMDB_OFFSET) return id - TV_TMDB_OFFSET;
  return id;
}

/** Detail-page URL from a `movies` row (movies table shared with TV / seasons). */
export function detailHrefFromStoredMovie(movie: {
  tmdb_id: number;
  title?: string | null;
  vote_count?: number | null;
  /** Populated for TV season rows — preferred over vote_count for parent show id. */
  parent_show_tmdb_id?: number | null;
}): string {
  const id = Number(movie.tmdb_id);
  if (!Number.isFinite(id)) return "/browse";
  const label = (movie.title && movie.title.trim()) || "Unknown";
  if (id >= TV_SEASON_OFFSET) {
    const fromCol =
      movie.parent_show_tmdb_id != null ? Number(movie.parent_show_tmdb_id) : NaN;
    const fromLegacy =
      movie.vote_count != null ? Number(movie.vote_count) : NaN;
    const parent = Number.isFinite(fromCol) ? fromCol : fromLegacy;
    if (Number.isFinite(parent) && parent > 0 && parent < TV_TMDB_OFFSET) {
      // Numeric only: detail page redirects to slug URL after loading the show.
      return `/show/${parent}`;
    }
    return "/browse?type=tv";
  }
  if (id >= TV_TMDB_OFFSET) {
    return tvDetailPath(label, id - TV_TMDB_OFFSET);
  }
  return movieDetailPath(label, id);
}
