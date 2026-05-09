import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMovieDetails } from "@/lib/tmdb/client";

export interface ConfirmedWatchedItem {
  tmdbId: number;
  watchedDate: string | null;
  rating: number | null;
  review: string | null;
}

export interface ConfirmedWatchlistItem {
  tmdbId: number;
}

export interface SaveRequestBody {
  watched: ConfirmedWatchedItem[];
  watchlist: ConfirmedWatchlistItem[];
  /**
   * "overwrite": upsert — update rating/notes/date for existing entries.
   * "skip": insert only new movies, leave existing ones untouched.
   * "check": dry run — just return how many duplicates exist, don't write anything.
   */
  mode: "overwrite" | "skip" | "check";
}

export interface SaveResponseBody {
  watchedImported: number;
  watchedSkipped: number;
  watchedDuplicates: number;
  watchlistImported: number;
  watchlistSkipped: number;
  errors: string[];
}

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

const ENSURE_CONCURRENCY = 10;
const UPSERT_CHUNK = 100;

/** Resolve TMDB id → movies.id for all ids (batch select + parallel fetch missing). */
async function ensureMovieRowsBulk(
  supabase: SupabaseServer,
  tmdbIds: number[],
): Promise<Map<number, number>> {
  const unique = [...new Set(tmdbIds.filter((id) => Number.isFinite(id)))];
  const map = new Map<number, number>();
  if (unique.length === 0) return map;

  const { data: existingRows } = await supabase.from("movies").select("id, tmdb_id").in("tmdb_id", unique);

  for (const row of existingRows ?? []) {
    map.set(Number(row.tmdb_id), Number(row.id));
  }

  const missing = unique.filter((id) => !map.has(id));
  if (missing.length === 0) return map;

  let mi = 0;
  async function ensureOne(tmdbId: number): Promise<void> {
    try {
      const d = await getMovieDetails(tmdbId);
      const year =
        d.release_date && d.release_date.length >= 4 ? Number(d.release_date.slice(0, 4)) : null;

      const { data, error } = await supabase
        .from("movies")
        .upsert(
          {
            tmdb_id: tmdbId,
            title: d.title,
            release_year: Number.isFinite(year) ? year : null,
            poster_path: d.poster_path,
            backdrop_path: d.backdrop_path,
            overview: d.overview,
            runtime: d.runtime,
            vote_average: d.vote_average,
            vote_count: d.vote_count,
            genres: d.genres,
          },
          { onConflict: "tmdb_id" },
        )
        .select("id")
        .single();

      if (!error && data?.id) {
        map.set(tmdbId, Number(data.id));
      }
    } catch {
      /* skip */
    }
  }

  async function worker() {
    while (true) {
      const i = mi++;
      if (i >= missing.length) break;
      await ensureOne(missing[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(ENSURE_CONCURRENCY, missing.length) }, () => worker()),
  );

  return map;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SaveRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mode = body.mode ?? "overwrite";

  // ── Check mode: count duplicates without writing ───────────────────────────
  if (mode === "check") {
    const tmdbIds = (body.watched ?? []).map((w) => w.tmdbId);
    if (tmdbIds.length === 0) {
      return NextResponse.json({
        watchedImported: 0,
        watchedSkipped: 0,
        watchedDuplicates: 0,
        watchlistImported: 0,
        watchlistSkipped: 0,
        errors: [],
      } satisfies SaveResponseBody);
    }

    const { data: existingMovies } = await supabase
      .from("movies")
      .select("id, tmdb_id")
      .in("tmdb_id", tmdbIds);

    const existingMovieIds = (existingMovies ?? []).map((m) => Number(m.id));

    let duplicates = 0;
    if (existingMovieIds.length > 0) {
      const { count } = await supabase
        .from("watched_movies")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("movie_id", existingMovieIds);
      duplicates = count ?? 0;
    }

    return NextResponse.json({
      watchedImported: 0,
      watchedSkipped: 0,
      watchedDuplicates: duplicates,
      watchlistImported: 0,
      watchlistSkipped: 0,
      errors: [],
    } satisfies SaveResponseBody);
  }

  // ── Actual save (overwrite or skip) ────────────────────────────────────────
  const stats: SaveResponseBody = {
    watchedImported: 0,
    watchedSkipped: 0,
    watchedDuplicates: 0,
    watchlistImported: 0,
    watchlistSkipped: 0,
    errors: [],
  };

  const watched = body.watched ?? [];
  const watchlist = body.watchlist ?? [];

  const allTmdbIds = [
    ...watched.map((w) => w.tmdbId),
    ...watchlist.map((w) => w.tmdbId),
  ];

  const tmdbToMovieId = await ensureMovieRowsBulk(supabase, allTmdbIds);

  // ── Watched ─────────────────────────────────────────────────────────────────
  if (mode === "overwrite") {
    const rows = watched
      .map((item) => {
        const movieId = tmdbToMovieId.get(item.tmdbId);
        if (!movieId) return null;
        return {
          user_id: user.id,
          movie_id: movieId,
          watched_at: item.watchedDate
            ? new Date(item.watchedDate).toISOString()
            : new Date().toISOString(),
          user_rating: item.rating ?? null,
          notes: item.review ?? null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r != null);

    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      const chunk = rows.slice(i, i + UPSERT_CHUNK);
      const { error } = await supabase.from("watched_movies").upsert(chunk, {
        onConflict: "user_id,movie_id",
      });
      if (error) {
        stats.errors.push(`Watched batch: ${error.message}`);
        stats.watchedSkipped += chunk.length;
      } else {
        stats.watchedImported += chunk.length;
      }
    }

    const unresolvedWatched = watched.length - rows.length;
    if (unresolvedWatched > 0) {
      stats.watchedSkipped += unresolvedWatched;
    }
  } else {
    // skip: insert only when not duplicate
    for (const item of watched) {
      const movieId = tmdbToMovieId.get(item.tmdbId);
      if (!movieId) {
        stats.watchedSkipped++;
        continue;
      }

      const { error } = await supabase.from("watched_movies").insert({
        user_id: user.id,
        movie_id: movieId,
        watched_at: item.watchedDate
          ? new Date(item.watchedDate).toISOString()
          : new Date().toISOString(),
        user_rating: item.rating ?? null,
        notes: item.review ?? null,
      });

      if (error) {
        if (error.code === "23505") {
          stats.watchedDuplicates++;
        } else {
          stats.watchedSkipped++;
          stats.errors.push(`Insert error: ${error.message}`);
        }
      } else {
        stats.watchedImported++;
      }
    }
  }

  // ── Watchlist ───────────────────────────────────────────────────────────────
  const wlRows = watchlist
    .map((item) => {
      const movieId = tmdbToMovieId.get(item.tmdbId);
      if (!movieId) return null;
      return { user_id: user.id, movie_id: movieId };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  for (let i = 0; i < wlRows.length; i += UPSERT_CHUNK) {
    const chunk = wlRows.slice(i, i + UPSERT_CHUNK);
    const { error } = await supabase.from("watchlist").upsert(chunk, {
      onConflict: "user_id,movie_id",
    });
    if (error) {
      stats.errors.push(`Watchlist batch: ${error.message}`);
      stats.watchlistSkipped += chunk.length;
    } else {
      stats.watchlistImported += chunk.length;
    }
  }

  const unresolvedWl = watchlist.length - wlRows.length;
  if (unresolvedWl > 0) {
    stats.watchlistSkipped += unresolvedWl;
  }

  return NextResponse.json(stats satisfies SaveResponseBody);
}
