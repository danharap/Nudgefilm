"use client";

import { posterUrl, TV_TMDB_OFFSET, TV_SEASON_OFFSET } from "@/lib/tmdb/constants";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

type Genre = { id: number; name: string };

export type WatchedFilm = {
  movie: {
    id: number;
    tmdb_id: number;
    title: string;
    poster_path: string | null;
    vote_count: number | null;
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
}: {
  films: WatchedFilm[];
  /** Hide on another member's public profile */
  showEditDiaryLink?: boolean;
  /** Shown under the section title (e.g. paginated public diary). */
  diaryScopeNote?: string | null;
  /** When set, poster links include ?reviewedBy=&libraryMovieId= so the title page can show their diary. */
  profileUsernameForReviewLinks?: string | null;
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
        <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 px-6 py-12 text-center">
          <p className="text-sm text-zinc-400">No films logged yet.</p>
          <Link
            href="/browse"
            className="mt-4 inline-block text-sm font-medium text-indigo-300 transition hover:text-indigo-200"
          >
            Browse films to add →
          </Link>
        </div>
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
              {sorted.map(({ movie, user_rating }) => {
                const poster = posterUrl(movie.poster_path, "w342");
                // Seasons: use vote_count (parent show tmdb_id stored there) for the link
                const baseHref =
                  movie.tmdb_id >= TV_SEASON_OFFSET
                    ? movie.vote_count != null
                      ? `/show/${movie.vote_count}`
                      : "/browse?type=tv"
                    : movie.tmdb_id >= TV_TMDB_OFFSET
                      ? `/show/${movie.tmdb_id - TV_TMDB_OFFSET}`
                      : `/movie/${movie.tmdb_id}`;
                const reviewQs =
                  profileUsernameForReviewLinks &&
                  profileUsernameForReviewLinks.trim().length > 0
                    ? `${baseHref.includes("?") ? "&" : "?"}reviewedBy=${encodeURIComponent(profileUsernameForReviewLinks.trim())}&libraryMovieId=${encodeURIComponent(String(movie.id))}`
                    : "";
                const href = `${baseHref}${reviewQs}`;
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
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center p-1">
                          <span className="line-clamp-3 text-center text-[9px] text-zinc-500">
                            {movie.title}
                          </span>
                        </div>
                      )}
                    </Link>
                    {movie.tmdb_id >= TV_SEASON_OFFSET ? (
                      <span className="absolute left-1 top-1 rounded bg-violet-600/80 px-1.5 py-0.5 text-[9px] font-bold text-white sm:text-[10px]">
                        S
                      </span>
                    ) : movie.tmdb_id >= TV_TMDB_OFFSET ? (
                      <span className="absolute left-1 top-1 rounded bg-violet-600/80 px-1.5 py-0.5 text-[9px] font-bold text-white sm:text-[10px]">
                        TV
                      </span>
                    ) : null}
                    {user_rating != null && (
                      <span className="absolute bottom-1.5 right-1.5 min-h-[1.375rem] min-w-[1.75rem] rounded-md bg-black/85 px-2 py-1 text-center text-xs font-bold tabular-nums text-indigo-100 ring-1 ring-white/15 sm:bottom-2 sm:right-2 sm:min-h-[1.5rem] sm:min-w-[2rem] sm:px-2.5 sm:text-sm">
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
