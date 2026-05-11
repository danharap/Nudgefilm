import { WatchedAddSearch } from "./WatchedAddSearch";
import { WatchedRowClient } from "./WatchedRowClient";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

type MovieRow = {
  id: number;
  tmdb_id: number;
  title: string;
  release_year: number | null;
  poster_path: string | null;
  vote_average: number | null;
  vote_count: number | null;
  parent_show_tmdb_id?: number | null;
};

type WatchedRow = {
  id: number;
  watched_at: string;
  user_rating: number | null;
  notes: string | null;
  custom_poster_url: string | null;
  movies: MovieRow | MovieRow[] | null;
};

async function loadWatched(userId: string): Promise<WatchedRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("watched_movies")
      .select(
        "id, watched_at, user_rating, notes, custom_poster_url, movies ( id, tmdb_id, title, release_year, poster_path, vote_average, vote_count, parent_show_tmdb_id )",
      )
      .eq("user_id", userId)
      .order("watched_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("[watched] supabase error:", error.code, error.message);
      return [];
    }
    return (data ?? []) as WatchedRow[];
  } catch (e) {
    console.error("[watched] unexpected error loading diary:", e);
    return [];
  }
}

export default async function WatchedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rows = user ? await loadWatched(user.id) : [];

  const items = rows.flatMap((r) => {
    const m = r.movies;
    if (!m) return [];
    const movie = Array.isArray(m) ? m[0] : m;
    return movie
      ? [
          {
            watchedRowId: r.id,
            watched_at: r.watched_at,
            user_rating: r.user_rating,
            notes: r.notes,
            custom_poster_url: r.custom_poster_url,
            movie,
          },
        ]
      : [];
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold text-white">Watched</h1>
        <p className="text-sm text-zinc-400">
          Your diary — titles here are excluded from future shortlists.
        </p>
      </header>

      {!user ? (
        <p className="mb-6 text-sm text-zinc-500">
          <Link href="/login" className="text-indigo-300 hover:text-indigo-200">
            Sign in
          </Link>{" "}
          to view your diary.
        </p>
      ) : null}

      {user ? (
        <WatchedAddSearch
          alreadyWatchedTmdbIds={items.map(({ movie }) => movie.tmdb_id)}
        />
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-zinc-900/30 px-6 py-16 text-center">
          <p className="text-zinc-400">No films logged yet.</p>
          <Link
            href="/results"
            className="mt-6 inline-block text-sm font-medium text-indigo-300 hover:text-indigo-200"
          >
            Mark something from your last run →
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map(
            ({
              watchedRowId,
              watched_at,
              user_rating,
              notes,
              custom_poster_url,
              movie,
            }) => (
              <WatchedRowClient
                key={`${watchedRowId}-${watched_at}`}
                userId={user?.id ?? ""}
                watchedRowId={watchedRowId}
                watched_at={watched_at}
                user_rating={user_rating}
                notes={notes}
                custom_poster_url={custom_poster_url}
                movie={movie}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}
