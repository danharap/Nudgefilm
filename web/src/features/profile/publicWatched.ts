import type { WatchedFilm } from "@/app/profile/FilmsSection";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Chunk size for public profile diary (initial load + scroll loads). */
export const PUBLIC_DIARY_PAGE_SIZE = 50;

const DIARY_MOVIE_SELECT =
  "watched_at, user_rating, movies ( id, tmdb_id, title, poster_path, vote_average, vote_count, genres )";

type RawRow = {
  watched_at: string | null;
  user_rating: number | null;
  movies: unknown;
};

export function mapRowsToWatchedFilms(rows: RawRow[]): WatchedFilm[] {
  return rows.flatMap((r) => {
    const m = r.movies as WatchedFilm["movie"] | WatchedFilm["movie"][] | null;
    if (!m) return [];
    const movie = Array.isArray(m) ? m[0] : m;
    return movie
      ? [{ movie, watched_at: r.watched_at, user_rating: r.user_rating }]
      : [];
  });
}

/** One page of diary rows (newest first). */
export async function fetchWatchedDiarySlice(
  supabase: SupabaseClient,
  userId: string,
  offset: number,
  limit: number,
): Promise<WatchedFilm[]> {
  const { data, error } = await supabase
    .from("watched_movies")
    .select(DIARY_MOVIE_SELECT)
    .eq("user_id", userId)
    .order("watched_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[publicWatched]", error.message);
    return [];
  }

  return mapRowsToWatchedFilms((data ?? []) as RawRow[]);
}

/** Full diary (e.g. migrations/tools). Prefer paginated slices for UI. */
export async function fetchAllWatchedFilmsForProfileView(
  supabase: SupabaseClient,
  userId: string,
): Promise<WatchedFilm[]> {
  const out: WatchedFilm[] = [];
  for (let offset = 0; ; offset += 1000) {
    const chunk = await fetchWatchedDiarySlice(supabase, userId, offset, 1000);
    if (chunk.length === 0) break;
    out.push(...chunk);
    if (chunk.length < 1000) break;
  }
  return out;
}
