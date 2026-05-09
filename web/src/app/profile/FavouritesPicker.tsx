"use client";

import { setFavouriteAction, removeFavouriteAction } from "./actions";
import { LibraryPosterEditor } from "@/components/library/LibraryPosterEditor";
import { posterUrl } from "@/lib/tmdb/constants";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

type Slot = {
  position: 1 | 2 | 3 | 4;
  tmdb_id: number | null;
  title: string | null;
  poster_path: string | null;
  custom_poster_url?: string | null;
};

type SearchHit = {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
};

export function FavouritesPicker({ slots, userId }: { slots: Slot[]; userId: string }) {
  const [activeSlot, setActiveSlot] = useState<1 | 2 | 3 | 4 | null>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const runSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/movies/search?q=${encodeURIComponent(q)}`, {
        credentials: "same-origin",
      });
      const data = (await res.json()) as { results?: SearchHit[] };
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    void runSearch(debounced);
  }, [debounced, runSearch]);

  function openSlot(pos: 1 | 2 | 3 | 4) {
    setActiveSlot(pos);
    setQuery("");
    setResults([]);
    setStatus(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function pick(hit: SearchHit) {
    if (!activeSlot) return;
    const pos = activeSlot;
    startTransition(async () => {
      try {
        await setFavouriteAction(hit.id, pos);
        setStatus(`"${hit.title}" set as favourite #${pos}.`);
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Failed to set favourite.");
      } finally {
        setActiveSlot(null);
        setQuery("");
        setResults([]);
      }
    });
  }

  function remove(pos: 1 | 2 | 3 | 4) {
    startTransition(async () => {
      try {
        await removeFavouriteAction(pos);
        setStatus(`Slot #${pos} cleared.`);
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Failed to remove.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {([1, 2, 3, 4] as const).map((pos) => {
          const slot = slots.find((s) => s.position === pos);
          const poster =
            slot?.custom_poster_url?.trim() ||
            (slot?.poster_path ? posterUrl(slot.poster_path, "w342") : null);
          const filled = !!slot?.tmdb_id;

          return (
            <div key={pos} className="group relative">
              <button
                type="button"
                onClick={() => openSlot(pos)}
                disabled={isPending}
                className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-800 transition hover:border-indigo-400/25 disabled:opacity-50"
              >
                {poster ? (
                  <Image
                    src={poster}
                    alt={slot?.title ?? ""}
                    fill
                    className="object-cover"
                    sizes="(max-width:640px) 25vw, 120px"
                    unoptimized={
                      typeof poster === "string" &&
                      poster.startsWith("http") &&
                      !poster.includes("image.tmdb.org")
                    }
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-2xl text-zinc-700">
                    +
                  </span>
                )}
                <span className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 to-transparent opacity-0 transition group-hover:opacity-100">
                  <span className="w-full py-2 text-center text-xs text-white">
                    {filled ? "Change" : "Pick"}
                  </span>
                </span>
              </button>
              {filled ? (
                <LibraryPosterEditor
                  variant="favourite"
                  userId={userId}
                  position={pos}
                  hasCustom={!!slot?.custom_poster_url?.trim()}
                  slotFilled
                />
              ) : null}

              {filled ? (
                <button
                  type="button"
                  onClick={() => remove(pos)}
                  disabled={isPending}
                  className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] text-zinc-400 ring-1 ring-white/10 hover:text-white group-hover:flex disabled:opacity-50"
                  aria-label={`Remove favourite ${pos}`}
                >
                  ×
                </button>
              ) : null}

              {slot?.title ? (
                <p className="mt-1.5 line-clamp-1 text-center text-[11px] text-zinc-400">
                  {slot.title}
                </p>
              ) : (
                <p className="mt-1.5 text-center text-[11px] text-zinc-700">
                  #{pos}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Inline search panel */}
      {activeSlot !== null ? (
        <div className="rounded-xl border border-white/10 bg-zinc-900 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              Picking for slot #{activeSlot}
            </p>
            <button
              type="button"
              onClick={() => { setActiveSlot(null); setQuery(""); setResults([]); }}
              className="text-xs text-zinc-600 hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies…"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:ring-2 focus:ring-indigo-400/25"
          />
          {searching ? (
            <p className="text-xs text-zinc-500">Searching…</p>
          ) : results.length > 0 ? (
            <ul className="max-h-48 overflow-y-auto space-y-1">
              {results.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => pick(h)}
                    className="flex w-full items-center gap-2 rounded-lg p-2 text-left transition hover:bg-white/5 disabled:opacity-50"
                  >
                    <span className="relative h-10 w-7 shrink-0 overflow-hidden rounded bg-zinc-800">
                      {h.poster_path ? (
                        <Image
                          src={posterUrl(h.poster_path, "w92")!}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="28px"
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-white">
                        {h.title}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {h.release_date?.slice(0, 4) ?? "—"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : query.length >= 2 && !searching ? (
            <p className="text-xs text-zinc-500">No results.</p>
          ) : null}
        </div>
      ) : null}

      {status ? (
        <p className="text-xs text-zinc-400" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
