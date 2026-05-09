"use client";

import { LibraryPosterEditor } from "@/components/library/LibraryPosterEditor";
import {
  detailHrefFromStoredMovie,
  posterUrl,
  TV_SEASON_OFFSET,
  TV_TMDB_OFFSET,
} from "@/lib/tmdb/constants";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

type Genre = { id: number; name: string };

export type WatchedFilm = {
  watched_row_id?: number;
  custom_poster_url?: string | null;
  movie: {
    id: number;
    tmdb_id: number;
    title: string;
    poster_path: string | null;
    vote_count: number | null;
    parent_show_tmdb_id?: number | null;
    genres: Genre[] | null;
  };
  watched_at: string | null;
  user_rating: number | null;
};

type Sort = "date-desc" | "date-asc" | "rating-desc" | "rating-asc" | "title";
type ContentType = "all" | "movies" | "tv";

const SORT_LABELS: Record<Sort, string> = {
  "date-desc": "Latest",
  "date-asc": "Oldest",
  "rating-desc": "Top rated",
  "rating-asc": "Lowest",
  title: "A–Z",
};

export function FilmsSection({
  films,
  showEditDiaryLink = true,
  diaryScopeNote,
  profileUsernameForReviewLinks,
  publicDiaryServerTotal,
  diaryOwnerUserId,
}: {
  films: WatchedFilm[];
  /** Hide on another member's public profile */
  showEditDiaryLink?: boolean;
  /** Shown under the section title (e.g. paginated public diary). */
  diaryScopeNote?: string | null;
  /** When set, poster links include ?reviewedBy=&libraryMovieId= so the title page can show their diary. */
  profileUsernameForReviewLinks?: string | null;
  /** Server diary count on public profiles (avoids "No films" while paginated slices are still loading). */
  publicDiaryServerTotal?: number | null;
  /** Logged-in profile owner — enables custom cover uploads on own diary. */
  diaryOwnerUserId?: string | null;
}) {
  const [sort, setSort] = useState<Sort>("date-desc");
  const [contentType, setContentType] = useState<ContentType>("all");
  const [genreFilter, setGenreFilter] = useState<number | null>(null);

  const availableGenres = useMemo<Genre[]>(() => {
    const map = new Map<number, string>();
    for (const { movie } of films) {
      for (const g of movie.genres ?? []) {
        if (!map.has(g.id)) map.set(g.id, g.name);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  }, [films]);

  const sorted = useMemo(() => {
    // Content type filter — seasons (>= TV_SEASON_OFFSET) are TV content too
    let list = [...films];
    if (contentType === "movies") {
      list = list.filter((f) => f.movie.tmdb_id < TV_TMDB_OFFSET);
    } else if (contentType === "tv") {
      list = list.filter((f) => f.movie.tmdb_id >= TV_TMDB_OFFSET);
    }
    // "all": full diary — movies, whole shows, and per-season logs
    if (genreFilter !== null) {
      list = list.filter((f) =>
        (f.movie.genres ?? []).some((g) => g.id === genreFilter),
      );
    }
    switch (sort) {
      case "date-asc":
        list.sort((a, b) => (a.watched_at ?? "").localeCompare(b.watched_at ?? ""));
        break;
      case "date-desc":
        list.sort((a, b) => (b.watched_at ?? "").localeCompare(a.watched_at ?? ""));
        break;
      case "rating-desc":
        list.sort((a, b) => (b.user_rating ?? -1) - (a.user_rating ?? -1));
        break;
      case "rating-asc":
        list.sort((a, b) => (a.user_rating ?? 999) - (b.user_rating ?? 999));
        break;
      case "title":
        list.sort((a, b) => a.movie.title.localeCompare(b.movie.title));
        break;
    }
    return list;
  }, [films, sort, genreFilter, contentType]);

  return (
    <section className="mb-12">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          {contentType === "tv" ? "Series" : contentType === "movies" ? "Films" : "All Watched"}{" "}
          <span className="text-sm font-normal text-zinc-500">({sorted.length})</span>
        </h2>
        {showEditDiaryLink ? (
          <Link
            href="/watched"
            className="text-xs text-indigo-300/70 transition hover:text-indigo-200"
          >
            Edit diary →
          </Link>
        ) : null}
      </div>

      {diaryScopeNote ? (
        <p className="mb-4 text-xs leading-relaxed text-zinc-500">{diaryScopeNote}</p>
      ) : null}

      {films.length === 0 ? (
        !showEditDiaryLink &&
        publicDiaryServerTotal != null &&
        publicDiaryServerTotal > 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 px-6 py-12 text-center">
            <p className="text-sm text-zinc-400">
              Diary loads in chunks while you scroll. This profile has{" "}
              <span className="font-medium text-zinc-300">{publicDiaryServerTotal}</span> titles
              logged.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 px-6 py-12 text-center">
            <p className="text-sm text-zinc-400">No films logged yet.</p>
            <Link
              href="/browse"
              className="mt-4 inline-block text-sm font-medium text-indigo-300 transition hover:text-indigo-200"
            >
              Browse films to add →
            </Link>
          </div>
        )
      ) : (
        <>
          {/* Controls */}
          <div className="mb-4 space-y-3">
            {/* Content type filter */}
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs text-zinc-500">Type</span>
              <div className="flex gap-1.5">
                {(["all", "movies", "tv"] as ContentType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setContentType(t); setGenreFilter(null); }}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                      contentType === t
                        ? "bg-indigo-500/15 text-indigo-300"
                        : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {t === "all" ? "All" : t === "movies" ? "Movies" : "TV Shows"}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort — scrollable row on mobile */}
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs text-zinc-500">Sort</span>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {(Object.keys(SORT_LABELS) as Sort[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                      sort === s
                        ? "bg-indigo-500/15 text-indigo-300"
                        : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {SORT_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Genre filter — horizontal scrollable chip row */}
            {availableGenres.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs text-zinc-500">Genre</span>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                  <button
                    onClick={() => setGenreFilter(null)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                      genreFilter === null
                        ? "bg-indigo-500/15 text-indigo-300"
                        : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    All
                  </button>
                  {availableGenres.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setGenreFilter(g.id === genreFilter ? null : g.id)}
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                        genreFilter === g.id
                          ? "bg-indigo-500/15 text-indigo-300"
                          : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Result count when filtered */}
          {genreFilter !== null && (
            <p className="mb-3 text-xs text-zinc-500">
              {sorted.length} film{sorted.length !== 1 ? "s" : ""} in this genre
              <button
                onClick={() => setGenreFilter(null)}
                className="ml-2 text-indigo-300/70 transition hover:text-indigo-200"
              >
                Clear ×
              </button>
            </p>
          )}

          {/* Poster grid */}
          {sorted.length === 0 ? (
            <p className="text-sm text-zinc-500">No films match this filter.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
              {sorted.map(({ movie, user_rating, watched_row_id, custom_poster_url }) => {
                const tmdbPoster = posterUrl(movie.poster_path, "w342");
                const poster =
                  custom_poster_url?.trim() && custom_poster_url.trim().length > 0
                    ? custom_poster_url.trim()
                    : tmdbPoster;
                const baseHref = detailHrefFromStoredMovie(movie);
                const reviewQs =
                  profileUsernameForReviewLinks &&
                  profileUsernameForReviewLinks.trim().length > 0
                    ? `${baseHref.includes("?") ? "&" : "?"}reviewedBy=${encodeURIComponent(profileUsernameForReviewLinks.trim())}&libraryMovieId=${encodeURIComponent(String(movie.id))}`
                    : "";
                const href = `${baseHref}${reviewQs}`;
                const canEditPoster =
                  !!diaryOwnerUserId &&
                  showEditDiaryLink &&
                  watched_row_id != null &&
                  Number.isFinite(watched_row_id);
                const isTvSeason = movie.tmdb_id >= TV_SEASON_OFFSET;
                const isTvShow =
                  movie.tmdb_id >= TV_TMDB_OFFSET && movie.tmdb_id < TV_SEASON_OFFSET;
                return (
                  <div key={movie.id} className="group relative">
                    <Link
                      href={href}
                      title={movie.title}
                      className="relative block aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800 ring-0 transition hover:ring-1 hover:ring-indigo-400/30"
                    >
                      {poster ? (
                        <Image
                          src={poster}
                          alt={movie.title}
                          fill
                          className="object-cover transition duration-300 group-hover:scale-[1.04]"
                          sizes="(max-width:640px) 25vw, (max-width:1024px) 16vw, 12vw"
                          unoptimized={poster.startsWith("http") && !poster.includes("image.tmdb.org")}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center p-1">
                          <span className="line-clamp-3 text-center text-[9px] text-zinc-500">
                            {movie.title}
                          </span>
                        </div>
                      )}
                    </Link>
                    {canEditPoster ? (
                      <LibraryPosterEditor
                        variant="watched"
                        userId={diaryOwnerUserId}
                        watchedRowId={watched_row_id}
                        hasCustom={!!custom_poster_url?.trim()}
                      />
                    ) : null}
                    {isTvSeason ? (
                      <span className="absolute left-1 top-1 rounded bg-violet-600/80 px-1.5 py-0.5 text-[9px] font-bold text-white sm:text-[10px]">
                        S
                      </span>
                    ) : isTvShow ? (
                      <span className="absolute left-1 top-1 rounded bg-violet-600/80 px-1.5 py-0.5 text-[9px] font-bold text-white sm:text-[10px]">
                        TV
                      </span>
                    ) : null}
                    {user_rating != null && (
                      <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/80 px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-indigo-200 ring-1 ring-white/10 backdrop-blur-sm sm:bottom-2 sm:right-2 sm:px-2 sm:text-xs">
                        {user_rating}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
