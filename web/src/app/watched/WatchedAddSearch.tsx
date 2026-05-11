"use client";

import { markWatched } from "@/app/actions/library";
import { posterUrl } from "@/lib/tmdb/constants";
import TmdbImage from "@/components/ui/TmdbImage";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type SearchHit = {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  vote_average: number;
};

type Props = {
  alreadyWatchedTmdbIds: number[];
};

export function WatchedAddSearch({ alreadyWatchedTmdbIds }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<number | null>(null);
  const watchedSet = useRef(new Set(alreadyWatchedTmdbIds));

  useEffect(() => {
    watchedSet.current = new Set(alreadyWatchedTmdbIds);
  }, [alreadyWatchedTmdbIds]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 320);
    return () => clearTimeout(t);
  }, [query]);

  const runSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/movies/search?q=${encodeURIComponent(q)}`,
        { credentials: "same-origin" },
      );
      const data = (await res.json()) as {
        results?: SearchHit[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Search failed");
      }
      setResults(data.results ?? []);
    } catch (e) {
      setResults([]);
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runSearch(debounced);
  }, [debounced, runSearch]);

  async function onAdd(tmdbId: number) {
    setAddingId(tmdbId);
    setError(null);
    try {
      await markWatched(tmdbId);
      watchedSet.current.add(tmdbId);
      router.refresh();
      setQuery("");
      setDebounced("");
      setResults([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setAddingId(null);
    }
  }

  return (
    <section className="mb-10 space-y-3 rounded-2xl border border-white/10 bg-zinc-900/30 p-4 sm:p-5">
      <div>
        <h2 className="text-sm font-medium text-zinc-300">Add a film</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Search TMDb by title — results appear as you type.
        </p>
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search movies…"
        autoComplete="off"
        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:ring-2 focus:ring-indigo-400/25"
        aria-label="Search movies to add to watched"
      />
      {error ? (
        <p className="text-xs text-red-300/90" role="alert">
          {error}
        </p>
      ) : null}
      {loading && debounced.length >= 2 ? (
        <p className="text-xs text-zinc-500">Searching…</p>
      ) : null}
      {results.length > 0 ? (
        <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {results.map((m) => {
            const year =
              m.release_date && m.release_date.length >= 4
                ? m.release_date.slice(0, 4)
                : "—";
            const poster = posterUrl(m.poster_path, "w342");
            const inDiary = watchedSet.current.has(m.id);
            return (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-2 py-2"
              >
                <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-zinc-800">
                  {poster ? (
                    <TmdbImage
                      src={poster}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {m.title}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {year} · ★ {m.vote_average?.toFixed(1) ?? "—"}
                  </p>
                </div>
                {inDiary ? (
                  <span className="shrink-0 text-xs text-zinc-500">In diary</span>
                ) : (
                  <button
                    type="button"
                    disabled={addingId === m.id}
                    onClick={() => onAdd(m.id)}
                    className="shrink-0 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1.5 text-xs font-medium text-indigo-200 transition hover:bg-indigo-400/20 disabled:opacity-50"
                  >
                    {addingId === m.id ? "Saving…" : "Watched"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {!loading && debounced.length >= 2 && results.length === 0 && !error ? (
        <p className="text-xs text-zinc-500">No titles found.</p>
      ) : null}
    </section>
  );
}
