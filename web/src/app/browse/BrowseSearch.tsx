"use client";

import { addTVToWatchlist, addToWatchlist, markTVWatched, markWatched } from "@/app/actions/library";
import { BrowseMovieCard, type BrowseMovie } from "@/app/browse/BrowseMovieCard";
import { browseMediaPath } from "@/lib/media-slug";
import { posterUrl } from "@/lib/tmdb/constants";
import TmdbImage from "@/components/ui/TmdbImage";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

type Hit = {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  vote_average: number;
  mediaType?: "movie" | "tv";
};

type SearchType = "movies" | "tv" | "all";

function hitToBrowseMovie(m: Hit): BrowseMovie {
  return {
    id: m.id,
    title: m.title,
    release_date: m.release_date,
    poster_path: m.poster_path,
    vote_average: m.vote_average,
    vote_count: 0,
    overview: "",
    genre_ids: [],
    mediaType: m.mediaType,
  };
}

async function fetchSearchHits(q: string, type: SearchType): Promise<Hit[]> {
  const url = `/api/movies/search?q=${encodeURIComponent(q)}&type=${type}`;
  const res = await fetch(url, { credentials: "same-origin" });
  const data = (await res.json()) as { results?: Hit[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Search failed");
  return data.results ?? [];
}

export function BrowseSearch({
  isLoggedIn,
  type = "all",
  watchedIds,
  watchlistIds,
  toolbarStart,
}: {
  isLoggedIn: boolean;
  type?: SearchType;
  watchedIds: Set<number>;
  watchlistIds: Set<number>;
  /** e.g. All / Movies / TV filter — kept in the same row as the search bar */
  toolbarStart?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [quickResults, setQuickResults] = useState<Hit[]>([]);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  const [committedQuery, setCommittedQuery] = useState<string | null>(null);
  const [gridResults, setGridResults] = useState<BrowseMovie[]>([]);
  const [gridLoading, setGridLoading] = useState(false);

  const [isPending, startTransition] = useTransition();
  const gridAnchorRef = useRef<HTMLDivElement>(null);

  const placeholder =
    type === "tv"
      ? "Search any TV show by title…"
      : type === "movies"
        ? "Search any film by title…"
        : "Search films and TV shows…";

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (debounced.length < 2) {
        setQuickResults([]);
        setQuickError(null);
        setQuickLoading(false);
        return;
      }
      if (committedQuery !== null && debounced === committedQuery) {
        setQuickResults([]);
        setQuickError(null);
        setQuickLoading(false);
        return;
      }
      setQuickLoading(true);
      setQuickError(null);
      try {
        const hits = await fetchSearchHits(debounced, type);
        if (!cancelled) {
          setQuickResults(hits);
        }
      } catch (e) {
        if (!cancelled) {
          setQuickError(e instanceof Error ? e.message : "Search failed");
          setQuickResults([]);
        }
      } finally {
        if (!cancelled) setQuickLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, committedQuery, type]);

  const showQuickPanel =
    debounced.length >= 2 &&
    (committedQuery === null || debounced !== committedQuery) &&
    (quickLoading || quickError !== null || quickResults.length > 0);

  const runCommittedSearch = useCallback(async () => {
    const q = query.trim();
    if (q.length < 2) {
      toast.error("Type at least 2 characters to search.");
      return;
    }
    if (debounced === q && quickResults.length > 0 && !quickLoading) {
      setCommittedQuery(q);
      setGridResults(quickResults.map(hitToBrowseMovie));
      gridAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setGridLoading(true);
    setQuickError(null);
    setCommittedQuery(q);
    try {
      const hits = await fetchSearchHits(q, type);
      setGridResults(hits.map(hitToBrowseMovie));
      gridAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
      setGridResults([]);
      setCommittedQuery(null);
    } finally {
      setGridLoading(false);
    }
  }, [query, type, debounced, quickResults, quickLoading]);

  function act(id: number, action: () => Promise<void>, msg: string) {
    if (!isLoggedIn) {
      toast.error("Sign in to save.");
      return;
    }
    startTransition(async () => {
      try {
        await action();
        toast.success(msg);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  function clearSearch() {
    setQuery("");
    setDebounced("");
    setCommittedQuery(null);
    setGridResults([]);
    setQuickResults([]);
    setQuickError(null);
  }

  return (
    <div className="w-full space-y-6">
      {/* One compact row on desktop so the type filter doesn’t center against the full results block */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-x-4">
        {toolbarStart ? (
          <div className="flex shrink-0 justify-start sm:self-center">{toolbarStart}</div>
        ) : null}
        <div className={`relative z-20 min-w-0 ${toolbarStart ? "" : "sm:col-span-full"}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void runCommittedSearch();
                }
              }}
              placeholder={placeholder}
              autoComplete="off"
              className="input-premium min-h-[48px] flex-1 rounded-2xl px-5 py-3.5 text-sm"
              aria-label="Search titles"
              aria-expanded={showQuickPanel}
              aria-controls="browse-search-suggestions"
            />
            <button
              type="button"
              onClick={() => void runCommittedSearch()}
              disabled={gridLoading}
              className="btn-brand shrink-0 rounded-2xl px-6 py-3.5 text-sm font-semibold disabled:opacity-60"
            >
              {gridLoading ? "Searching…" : "Search"}
            </button>
          </div>

        {/* Quick picks — solid background so posters behind don’t bleed through */}
        {showQuickPanel ? (
          <div
            id="browse-search-suggestions"
            className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[28rem] overflow-y-auto rounded-2xl border border-[var(--surface-border)] shadow-2xl ring-1 ring-black/10"
            style={{
              backgroundColor: "var(--search-popover-bg)",
              boxShadow: "var(--shadow-lift)",
            }}
          >
            {quickLoading ? (
              <p className="px-4 py-3 text-xs text-tertiary">Searching…</p>
            ) : quickError ? (
              <p className="px-4 py-3 text-xs text-red-400">{quickError}</p>
            ) : (
              <ul className="divide-y divide-[var(--surface-border)]">
                {quickResults.map((m) => {
                  const year = m.release_date?.slice(0, 4) ?? "—";
                  const poster = posterUrl(m.poster_path, "w92");
                  const isTV = m.mediaType === "tv";
                  const href = browseMediaPath(m.title, m.id, m.mediaType);
                  return (
                    <li
                      key={`${m.mediaType ?? "movie"}-${m.id}`}
                      className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-[var(--surface-3)]"
                    >
                      <Link
                        href={href}
                        className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-zinc-800 ring-1 ring-[var(--surface-border)]"
                      >
                        {poster ? (
                          <TmdbImage src={poster} alt="" fill className="object-cover" sizes="40px" />
                        ) : null}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            href={href}
                            className="block truncate text-sm font-medium text-primary hover:text-indigo-400"
                          >
                            {m.title}
                          </Link>
                          {isTV && (
                            <span className="shrink-0 rounded bg-violet-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              TV
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-tertiary">
                          {year} · ★ {m.vote_average?.toFixed(1) ?? "—"}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            act(
                              m.id,
                              () => (isTV ? markTVWatched(m.id) : markWatched(m.id)),
                              "Added to diary.",
                            )
                          }
                          className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-secondary hover:text-primary disabled:opacity-50"
                        >
                          Watched
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            act(
                              m.id,
                              () =>
                                isTV ? addTVToWatchlist(m.id) : addToWatchlist(m.id),
                              "Added to watchlist.",
                            )
                          }
                          className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-secondary hover:text-primary disabled:opacity-50"
                        >
                          + List
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
        </div>
      </div>

      <p className="text-xs text-tertiary">
        <span className="text-secondary">Tip:</span> suggestions appear as you type; press{" "}
        <kbd className="rounded border border-[var(--surface-border)] bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px] text-secondary">
          Enter
        </kbd>{" "}
        or <span className="text-secondary">Search</span> for full results in the grid below.
      </p>

      {/* Full results — same cards as Trending / Popular */}
      <div ref={gridAnchorRef}>
        {committedQuery ? (
          <section className="space-y-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-2)]/40 p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-primary">Results</h2>
                <p className="text-sm text-tertiary">
                  For &ldquo;{committedQuery}&rdquo;
                  {gridResults.length > 0 ? (
                    <span className="text-tertiary"> · {gridResults.length} titles</span>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                onClick={clearSearch}
                className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-1)] px-3 py-1.5 text-xs font-medium text-secondary transition hover:text-primary"
              >
                Clear search
              </button>
            </div>
            {gridLoading ? (
              <p className="py-12 text-center text-sm text-tertiary">Loading results…</p>
            ) : gridResults.length === 0 ? (
              <p className="py-12 text-center text-sm text-tertiary">No matches. Try another title.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {gridResults.map((m) => (
                  <BrowseMovieCard
                    key={`${m.mediaType ?? "movie"}-${m.id}`}
                    movie={m}
                    isWatched={watchedIds.has(m.id)}
                    isWatchlisted={watchlistIds.has(m.id)}
                    isLoggedIn={isLoggedIn}
                  />
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
