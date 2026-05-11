import { WatchlistRemoveButton } from "./WatchlistRemoveButton";
import { detailHrefFromStoredMovie, posterUrl } from "@/lib/tmdb/constants";
import { createClient } from "@/lib/supabase/server";
import TmdbImage from "@/components/ui/TmdbImage";
import Link from "next/link";

export const dynamic = "force-dynamic";

type MovieRow = {
  id: number;
  tmdb_id: number;
  title: string;
  release_year: number | null;
  poster_path: string | null;
  vote_average: number | null;
  overview: string | null;
  vote_count: number | null;
};

export default async function WatchlistPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rows } = user
    ? await supabase
        .from("watchlist")
        .select(
          "id, created_at, movies ( id, tmdb_id, title, release_year, poster_path, vote_average, overview, vote_count )",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500)
    : { data: null };

  const items =
    rows?.flatMap((r) => {
      const m = r.movies as MovieRow | MovieRow[] | null;
      if (!m) return [];
      const movie = Array.isArray(m) ? m[0] : m;
      return movie ? [{ rowId: Number(r.id), movie }] : [];
    }) ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <header className="mb-10 space-y-2">
        <h1 className="text-3xl font-semibold text-primary">Watchlist</h1>
        <p className="text-sm text-secondary">
          Films you&apos;re keeping on deck.{" "}
          {!user ? "Sign in to sync this list across devices." : null}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link
            href="/browse"
            className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-2)] px-4 py-2 text-xs font-medium text-secondary transition hover:text-primary"
          >
            Browse titles
          </Link>
          <Link
            href="/recommend"
            className="rounded-full border border-indigo-400/25 bg-indigo-500/10 px-4 py-2 text-xs font-medium text-indigo-500 transition hover:border-indigo-300/40"
          >
            Find by vibe
          </Link>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="surface-card-subtle rounded-2xl border border-dashed px-6 py-16 text-center">
          <p className="text-secondary">Nothing saved yet.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/browse"
              className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-secondary transition hover:text-primary"
            >
              Browse and add
            </Link>
            <Link
              href="/recommend"
              className="rounded-full border border-indigo-400/25 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-500 transition hover:border-indigo-300/40"
            >
              Find by vibe
            </Link>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map(({ rowId, movie }) => {
            const p = posterUrl(movie.poster_path, "w342");
            const href = detailHrefFromStoredMovie(movie);
            return (
              <li
                key={rowId}
                className="surface-card premium-card flex gap-4 rounded-2xl p-4"
              >
                <Link
                  href={href}
                  className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-800"
                >
                  {p ? (
                    <TmdbImage
                      src={p}
                      alt={movie.title}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  ) : null}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={href}
                    className="font-medium text-primary hover:text-indigo-500"
                  >
                    {movie.title}
                  </Link>
                  {movie.release_year ? (
                    <p className="text-xs text-tertiary">{movie.release_year}</p>
                  ) : null}
                  {movie.vote_average != null ? (
                    <p className="text-xs text-indigo-500/80">
                      ★ {Number(movie.vote_average).toFixed(1)}
                    </p>
                  ) : null}
                  <div className="mt-3">
                    <WatchlistRemoveButton watchlistRowId={rowId} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
