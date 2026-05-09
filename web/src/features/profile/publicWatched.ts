import type { WatchedFilm } from "@/app/profile/FilmsSection";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Chunk size for public profile diary (initial load + scroll loads). */
export const PUBLIC_DIARY_PAGE_SIZE = 50;

const DIARY_MOVIE_SELECT =
  "id, watched_at, user_rating, custom_poster_url, movies ( id, tmdb_id, title, poster_path, vote_average, vote_count, genres, parent_show_tmdb_id )";

type RawRow = {
  id: number;
  watched_at: string | null;
  user_rating: number | null;
  custom_poster_url?: string | null;
  movies: unknown;
};

export function mapRowsToWatchedFilms(rows: RawRow[]): WatchedFilm[] {
  return rows.flatMap((r) => {
    const m = r.movies as WatchedFilm["movie"] | WatchedFilm["movie"][] | null;
    if (!m) return [];
    const movie = Array.isArray(m) ? m[0] : m;
    return movie
      ? [
          {
            watched_row_id: r.id,
            custom_poster_url: r.custom_poster_url ?? null,
            movie,
            watched_at: r.watched_at,
            user_rating: r.user_rating,
          },
        ]
      : [];
  });
}

export type WatchedDiarySlice = {
  films: WatchedFilm[];
  /** Rows returned from `watched_movies` before flattening the movie join (drives pagination offset). */
  rawRowCount: number;
};

/** One page of diary rows (newest first). */
export async function fetchWatchedDiarySlice(
  supabase: SupabaseClient,
  userId: string,
  offset: number,
  limit: number,
): Promise<WatchedDiarySlice> {
  const { data, error } = await supabase
    .from("watched_movies")
    .select(DIARY_MOVIE_SELECT)
    .eq("user_id", userId)
    .order("watched_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[publicWatched]", error.message);
    return { films: [], rawRowCount: 0 };
  }

  const rows = (data ?? []) as RawRow[];
  return {
    films: mapRowsToWatchedFilms(rows),
    rawRowCount: rows.length,
  };
}

/** Full diary (e.g. migrations/tools). Prefer paginated slices for UI. */
export async function fetchAllWatchedFilmsForProfileView(
  supabase: SupabaseClient,
  userId: string,
): Promise<WatchedFilm[]> {
  const out: WatchedFilm[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { films, rawRowCount } = await fetchWatchedDiarySlice(
      supabase,
      userId,
      offset,
      1000,
    );
    if (rawRowCount === 0) break;
    out.push(...films);
    if (rawRowCount < 1000) break;
  }
  return out;
}
