"use client";

import { addTVToWatchlist, addToWatchlist, markTVWatched, markWatched } from "@/app/actions/library";
import { BrowseMovieCard, type BrowseMovie } from "@/app/browse/BrowseMovieCard";
import { useBrowseLibrary } from "@/app/browse/BrowseLibraryContext";
import { browseMediaPath } from "@/lib/media-slug";
import { posterUrl } from "@/lib/tmdb/constants";
import TmdbImage from "@/components/ui/TmdbImage";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import type { ContentType } from "./BrowseTypeFilter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MovieHit = {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  vote_average: number;
  mediaType: "movie" | "tv";
};

type PersonHit = {
  id: number;
  name: string;
  known_for_department: string | null;
  profile_path: string | null;
  known_for_titles: string[];
  mediaType: "person";
};

type SearchHit = MovieHit | PersonHit;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPersonHit(hit: SearchHit): hit is PersonHit {
  return hit.mediaType === "person";
}

function searchPlaceholder(type: ContentType): string {
  if (type === "people") return "Search actors, directors, writers…";
  if (type === "movies") return "Search any film by title…";
  if (type === "tv") return "Search any TV show by title…";
  return "Search films and TV shows…";
}

function movieHitToBrowseMovie(m: MovieHit): BrowseMovie {
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

async function fetchHits(
  q: string,
  type: ContentType,
  signal: AbortSignal,
): Promise<SearchHit[]> {
  const url = `/api/movies/search?q=${encodeURIComponent(q)}&type=${type}`;
  const res = await fetch(url, { credentials: "same-origin", signal });
  const data = (await res.json()) as { results?: SearchHit[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Search failed");
  return data.results ?? [];
}

// ---------------------------------------------------------------------------
// Person result cards
// ---------------------------------------------------------------------------

function PersonQuickRow({ person }: { person: PersonHit }) {
  const profileSrc = posterUrl(person.profile_path, "w92");
  return (
    <Link
      href={`/person/${person.id}`}
      className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-[var(--surface-3)]"
    >
      <div className="relative size-11 shrink-0 overflow-hidden rounded-full bg-zinc-800 ring-1 ring-[var(--surface-border)]">
        {profileSrc ? (
          <TmdbImage src={profileSrc} alt="" fill className="object-cover" sizes="44px" />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-600">
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
              <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z" />
            </svg>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-primary">{person.name}</p>
        <p className="text-xs text-tertiary">
          {person.known_for_department ?? "Film"}
          {person.known_for_titles.length > 0 && (
            <>
              {" · "}
              <span className="text-zinc-500">{person.known_for_titles.slice(0, 2).join(", ")}</span>
            </>
          )}
        </p>
      </div>
      <span className="shrink-0 text-xs text-zinc-600">→</span>
    </Link>
  );
}

function PersonGridCard({ person }: { person: PersonHit }) {
  const profileSrc = posterUrl(person.profile_path, "w342");
  return (
    <Link
      href={`/person/${person.id}`}
      className="premium-card group flex flex-col overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-1)] transition-all duration-300 hover:-translate-y-1 hover:border-violet-300/40"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-800">
        {profileSrc ? (
          <TmdbImage
            src={profileSrc}
            alt={person.name}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.06]"
            sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 20vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-600">
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-12 opacity-40">
              <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z" />
            </svg>
          </div>
        )}
        {person.known_for_department && (
          <div className="absolute bottom-2 left-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-violet-200 backdrop-blur-sm ring-1 ring-white/10">
            {person.known_for_department}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-semibold text-primary transition group-hover:text-violet-400">
          {person.name}
        </p>
        {person.known_for_titles.length > 0 && (
          <p className="line-clamp-2 text-[11px] leading-relaxed text-tertiary">
            {person.known_for_titles.join(" · ")}
          </p>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BrowseSearch({
  type = "all",
  toolbarStart,
}: {
  type?: ContentType;
  toolbarStart?: ReactNode;
}) {
  const { isLoggedIn } = useBrowseLibrary();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [quickResults, setQuickResults] = useState<SearchHit[]>([]);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  const [committedQuery, setCommittedQuery] = useState<string | null>(null);
  const [committedType, setCommittedType] = useState<ContentType>("all");
  const [gridResults, setGridResults] = useState<SearchHit[]>([]);
  const [gridLoading, setGridLoading] = useState(false);

  const [isPending, startTransition] = useTransition();
  const gridAnchorRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Clear results when the filter tab changes
  useEffect(() => {
    setQuery("");
    setDebounced("");
    setQuickResults([]);
    setQuickError(null);
    setCommittedQuery(null);
    setGridResults([]);
  }, [type]);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 500);
    return () => clearTimeout(t);
  }, [query]);

  // Quick-pick fetch with abort on stale requests
  useEffect(() => {
    if (debounced.length < 3) {
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

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setQuickLoading(true);
    setQuickError(null);

    fetchHits(debounced, type, controller.signal)
      .then((hits) => {
        if (!controller.signal.aborted) setQuickResults(hits);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setQuickError(e instanceof Error ? e.message : "Search failed");
        setQuickResults([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setQuickLoading(false);
      });

    return () => controller.abort();
  }, [debounced, committedQuery, type]);

  const showQuickPanel =
    debounced.length >= 2 &&
    (committedQuery === null || debounced !== committedQuery) &&
    (quickLoading || quickError !== null || quickResults.length > 0);

  const runCommittedSearch = useCallback(async () => {
    const q = query.trim();
    if (q.length < 3) {
      toast.error("Type at least 3 characters to search.");
      return;
    }
    if (debounced === q && quickResults.length > 0 && !quickLoading) {
      setCommittedQuery(q);
      setCommittedType(type);
      setGridResults(quickResults);
      gridAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setGridLoading(true);
    setQuickError(null);
    setCommittedQuery(q);
    setCommittedType(type);
    try {
      const hits = await fetchHits(q, type, new AbortController().signal);
      setGridResults(hits);
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
    <div className="w-full space-y-4">
      {/* Single toolbar row: type filter + 18+ toggle + search input */}
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
              placeholder={searchPlaceholder(type)}
              autoComplete="off"
              className="input-premium min-h-[48px] flex-1 rounded-2xl px-5 py-3.5 text-sm"
              aria-label={`Search ${type}`}
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

          {/* Quick-pick dropdown */}
          {showQuickPanel ? (
            <div
              id="browse-search-suggestions"
              role="listbox"
              aria-label="Search suggestions"
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
                  {quickResults.map((hit) => {
                    if (isPersonHit(hit)) {
                      return (
                        <li key={`person-${hit.id}`}>
                          <PersonQuickRow person={hit} />
                        </li>
                      );
                    }
                    const year = hit.release_date?.slice(0, 4) ?? "—";
                    const poster = posterUrl(hit.poster_path, "w92");
                    const isTV = hit.mediaType === "tv";
                    const href = browseMediaPath(hit.title, hit.id, hit.mediaType);
                    return (
                      <li
                        key={`${hit.mediaType}-${hit.id}`}
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
                              {hit.title}
                            </Link>
                            {isTV && (
                              <span className="shrink-0 rounded bg-violet-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                TV
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-tertiary">
                            {year} · ★ {hit.vote_average?.toFixed(1) ?? "—"}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              act(
                                hit.id,
                                () => (isTV ? markTVWatched(hit.id) : markWatched(hit.id)),
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
                                hit.id,
                                () => (isTV ? addTVToWatchlist(hit.id) : addToWatchlist(hit.id)),
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

      {/* Tip */}
      <p className="text-xs text-tertiary">
        <span className="text-secondary">Tip:</span> suggestions appear as you type; press{" "}
        <kbd className="rounded border border-[var(--surface-border)] bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px] text-secondary">
          Enter
        </kbd>{" "}
        or <span className="text-secondary">Search</span> for full results below.
      </p>

      {/* Full results grid */}
      <div ref={gridAnchorRef}>
        {committedQuery ? (
          <section className="space-y-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-2)]/40 p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-primary">
                  {committedType === "people" ? "People" : "Results"}
                </h2>
                <p className="text-sm text-tertiary">
                  For &ldquo;{committedQuery}&rdquo;
                  {gridResults.length > 0 && (
                    <span>
                      {" · "}
                      {gridResults.length}{" "}
                      {committedType === "people" ? "people" : "titles"}
                    </span>
                  )}
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
              <p className="py-12 text-center text-sm text-tertiary">
                {committedType === "people"
                  ? "No people found. Try a different name."
                  : "No matches. Try another title."}
              </p>
            ) : committedType === "people" ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {gridResults.map((hit) =>
                  isPersonHit(hit) ? (
                    <PersonGridCard key={`person-${hit.id}`} person={hit} />
                  ) : null,
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {gridResults.map((hit) =>
                  !isPersonHit(hit) ? (
                    <BrowseMovieCard
                      key={`${hit.mediaType}-${hit.id}`}
                      movie={movieHitToBrowseMovie(hit)}
                    />
                  ) : null,
                )}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
