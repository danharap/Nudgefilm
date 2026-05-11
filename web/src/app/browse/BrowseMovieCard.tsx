"use client";

import {
  addTVToWatchlist,
  addToWatchlist,
  markTVWatched,
  markWatched,
  removeFromWatchlist,
  removeTVFromWatchlist,
} from "@/app/actions/library";
import { movieToast } from "@/components/ui/movieToast";
import { browseMediaPath } from "@/lib/media-slug";
import { posterUrl } from "@/lib/tmdb/constants";
import TmdbImage from "@/components/ui/TmdbImage";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export type BrowseMovie = {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  vote_average: number;
  vote_count: number;
  overview: string;
  genre_ids: number[];
  mediaType?: "movie" | "tv";
};

type Props = {
  movie: BrowseMovie;
  isWatched?: boolean;
  isWatchlisted?: boolean;
  isLoggedIn: boolean;
};

export function BrowseMovieCard({ movie, isWatched, isWatchlisted, isLoggedIn }: Props) {
  const [watched, setWatched] = useState(isWatched ?? false);
  const [watchlisted, setWatchlisted] = useState(isWatchlisted ?? false);
  const [isPending, startTransition] = useTransition();

  const year = movie.release_date?.slice(0, 4) ?? "—";
  const poster = posterUrl(movie.poster_path, "w342");
  const href = browseMediaPath(movie.title, movie.id, movie.mediaType);
  const isTV = movie.mediaType === "tv";

  function run(action: () => Promise<void>, onSuccess: () => void, msg: string) {
    if (!isLoggedIn) {
      toast.error("Sign in to save films.");
      return;
    }
    startTransition(async () => {
      try {
        await action();
        onSuccess();
        movieToast(msg, movie.title, movie.poster_path);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <article className="premium-card group flex flex-col overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-1)] transition-all duration-300 hover:-translate-y-1 hover:border-indigo-300/40">
      <Link
        href={href}
        className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-800"
      >
        {poster ? (
          <TmdbImage
            src={poster}
            alt={movie.title}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.06]"
            sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 20vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-zinc-600 text-xs text-center">
            {movie.title}
          </div>
        )}
        {/* Score badge */}
        {movie.vote_average > 0 && (
          <div className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-200 backdrop-blur-sm ring-1 ring-white/10">
            ★ {movie.vote_average.toFixed(1)}
          </div>
        )}
        {/* TV badge */}
        {isTV && (
          <div className="absolute right-2 top-2 rounded-md bg-violet-600/80 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            TV
          </div>
        )}
      </Link>

        <div className="flex flex-1 flex-col gap-2.5 p-3">
        <div>
          <Link
            href={href}
            className="line-clamp-2 text-sm font-medium text-primary transition hover:text-indigo-500"
          >
            {movie.title}
          </Link>
          <p className="mt-0.5 text-xs text-tertiary">{year}</p>
        </div>

        <div className="mt-auto flex gap-1.5 pt-1">
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(
                () =>
                  isTV ? markTVWatched(movie.id) : markWatched(movie.id),
                () => setWatched(true),
                "Added to your diary.",
              )
            }
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition disabled:opacity-50 ${
              watched
                ? "border border-indigo-400/30 bg-indigo-400/10 text-indigo-500"
                : "border border-[var(--surface-border)] bg-[var(--surface-2)] text-secondary hover:text-primary"
            }`}
          >
            {watched ? "✓ Watched" : "Watched"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(
                () =>
                  watchlisted
                    ? isTV
                      ? removeTVFromWatchlist(movie.id)
                      : removeFromWatchlist(movie.id)
                    : isTV
                      ? addTVToWatchlist(movie.id)
                      : addToWatchlist(movie.id),
                () => setWatchlisted((p) => !p),
                watchlisted ? "Removed from watchlist." : "Added to watchlist.",
              )
            }
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition disabled:opacity-50 ${
              watchlisted
                ? "border border-indigo-400/30 bg-indigo-400/10 text-indigo-500 hover:bg-indigo-400/20"
                : "border border-[var(--surface-border)] bg-[var(--surface-2)] text-secondary hover:text-primary"
            }`}
          >
            {watchlisted ? "✓ Queued — Remove" : "Watchlist"}
          </button>
        </div>
      </div>
    </article>
  );
}
