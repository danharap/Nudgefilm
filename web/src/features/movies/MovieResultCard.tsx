"use client";

import {
  addToWatchlist,
  dismissMovie,
  markWatched,
} from "@/app/actions/library";
import { movieToast } from "@/components/ui/movieToast";
import { movieDetailPath } from "@/lib/media-slug";
import { posterUrl } from "@/lib/tmdb/constants";
import type { RecommendedMovie } from "@/types/movie";
import TmdbImage from "@/components/ui/TmdbImage";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

type Props = { movie: RecommendedMovie };

export function MovieResultCard({ movie }: Props) {
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<void>, successMsg: string) {
    startTransition(async () => {
      try {
        await action();
        movieToast(successMsg, movie.title, movie.poster_path);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  const poster = posterUrl(movie.poster_path, "w500");

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-900/60 shadow-xl shadow-black/40 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-400/30 hover:shadow-indigo-900/30 md:flex-row">
      <Link
        href={movieDetailPath(movie.title, movie.id)}
        className="relative aspect-[2/3] w-full shrink-0 overflow-hidden bg-zinc-800 md:w-44 lg:w-52"
      >
        {poster ? (
          <TmdbImage
            src={poster}
            alt={movie.title}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.06]"
            sizes="(max-width:768px) 100vw, 208px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-600 text-xs">
            No poster
          </div>
        )}
        {/* Subtle gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-white">
              <Link href={movieDetailPath(movie.title, movie.id)} className="transition hover:text-indigo-200">
                {movie.title}
              </Link>
            </h2>
            {movie.release_year ? (
              <span className="text-sm text-zinc-500">{movie.release_year}</span>
            ) : null}
            {movie.runtime ? (
              <span className="text-sm text-zinc-500">{movie.runtime} min</span>
            ) : null}
          </div>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm text-indigo-300/80">
            <span>★ {movie.vote_average.toFixed(1)}</span>
            <span className="text-zinc-600">/ 10</span>
            {movie.vote_count ? (
              <span className="text-xs text-zinc-600">
                {movie.vote_count.toLocaleString()} votes
              </span>
            ) : null}
          </p>
        </div>

        <p className="line-clamp-4 text-sm leading-relaxed text-zinc-400">
          {movie.overview || "No overview available."}
        </p>

        <ul className="flex flex-wrap gap-2">
          {movie.reasons.map((r) => (
            <li
              key={r.label}
              className="rounded-full border border-indigo-400/20 bg-indigo-400/8 px-2.5 py-0.5 text-xs text-indigo-200/90"
            >
              {r.label}
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => markWatched(movie.id), "Added to your diary.")}
            className="rounded-full bg-indigo-500/15 px-4 py-2 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/25 disabled:opacity-50"
          >
            Watched
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => addToWatchlist(movie.id), "Added to watchlist.")}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:border-indigo-400/30 hover:text-white disabled:opacity-50"
          >
            Watchlist
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => dismissMovie(movie.id, "not_interested"), "Hidden from future runs.")}
            className="rounded-full px-4 py-2 text-sm text-zinc-600 transition hover:text-zinc-400 disabled:opacity-50"
          >
            Not for me
          </button>
        </div>
      </div>
    </article>
  );
}
