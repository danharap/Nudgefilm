"use client";

import { LibraryPosterEditor } from "@/components/library/LibraryPosterEditor";
import { detailHrefFromStoredMovie, posterUrl } from "@/lib/tmdb/constants";
import Image from "next/image"; // kept for custom_poster_url (already unoptimized below)
import Link from "next/link";
import { WatchedEntryActions } from "./WatchedEntryActions";

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

export function WatchedRowClient({
  userId,
  watchedRowId,
  watched_at,
  user_rating,
  notes,
  custom_poster_url,
  movie,
}: {
  userId: string;
  watchedRowId: number;
  watched_at: string;
  user_rating: number | null;
  notes: string | null;
  custom_poster_url: string | null;
  movie: MovieRow;
}) {
  const tmdbPoster = posterUrl(movie.poster_path, "w342");
  const poster =
    custom_poster_url?.trim() ||
    tmdbPoster;
  const href = detailHrefFromStoredMovie(movie);

  return (
    <li className="flex gap-4 rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
      <div className="group relative h-28 w-20 shrink-0">
        <Link
          href={href}
          className="relative block h-28 w-20 overflow-hidden rounded-lg bg-zinc-800"
        >
          {poster ? (
            <Image
              src={poster}
              alt={movie.title}
              fill
              className="object-cover"
              sizes="80px"
              unoptimized
            />
          ) : null}
        </Link>
        {userId ? (
          <LibraryPosterEditor
            variant="watched"
            userId={userId}
            watchedRowId={watchedRowId}
            hasCustom={!!custom_poster_url?.trim()}
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <Link href={href} className="font-medium text-white hover:text-indigo-200">
          {movie.title}
        </Link>
        <p className="text-xs text-zinc-500">
          Watched{" "}
          {watched_at ? new Date(watched_at).toLocaleDateString() : "—"}
        </p>
        {movie.vote_average != null ? (
          <p className="text-xs text-zinc-500">
            TMDb ★ {Number(movie.vote_average).toFixed(1)}
            {movie.vote_count
              ? ` · ${movie.vote_count.toLocaleString()} votes`
              : ""}
          </p>
        ) : null}
        {notes ? (
          <p className="mt-1 line-clamp-2 text-xs italic text-zinc-400">
            &ldquo;{notes}&rdquo;
          </p>
        ) : null}
        <WatchedEntryActions
          movie={movie}
          initialRating={user_rating ?? null}
          initialNotes={notes ?? null}
        />
      </div>
    </li>
  );
}
