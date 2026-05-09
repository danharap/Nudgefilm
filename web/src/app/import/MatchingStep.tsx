"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import type { ParsedImport, LetterboxdWatchedEntry, LetterboxdWatchlistEntry } from "@/lib/letterboxd/parser";
import type { MatchResult } from "@/app/api/import/match/route";

export interface MatchedWatchedItem {
  tmdbId: number;
  watchedDate: string | null;
  rating: number | null;
  review: string | null;
}

export interface MatchedWatchlistItem {
  tmdbId: number;
}

export interface MatchedData {
  watched: MatchedWatchedItem[];
  watchlist: MatchedWatchlistItem[];
  skippedCount: number;
  likedFilmTitles: string[];
}

interface MatchingStepProps {
  parsed: ParsedImport;
  onMatched: (data: MatchedData) => void;
}

type Phase = "pending" | "matching" | "done";

const BATCH_SIZE = 45;
const BATCH_DELAY_MS = 80;

function ImportRefreshWarning() {
  return (
    <div className="w-full rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
      Don&apos;t refresh or close this tab until the import finishes — you could lose progress.
    </div>
  );
}

async function fetchMatchBatch(
  movies: Array<{ title: string; year: number | null; index: number }>,
): Promise<MatchResult[]> {
  const res = await fetch("/api/import/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ movies }),
  });
  if (!res.ok) throw new Error("Match request failed");
  const data = await res.json();
  return data.results as MatchResult[];
}

export function MatchingStep({ parsed, onMatched }: MatchingStepProps) {
  const [phase, setPhase] = useState<Phase>("pending");
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [matchError, setMatchError] = useState<string | null>(null);
  const hasStarted = useRef(false);

  const runMatching = useCallback(async () => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    setPhase("matching");

    const allItems: Array<{
      title: string;
      year: number | null;
      index: number;
      type: "watched" | "watchlist";
      entry: LetterboxdWatchedEntry | LetterboxdWatchlistEntry;
    }> = [
      ...parsed.watched.map((e, i) => ({
        title: e.title,
        year: e.year,
        index: i,
        type: "watched" as const,
        entry: e,
      })),
      ...parsed.watchlist.map((e, i) => ({
        title: e.title,
        year: e.year,
        index: parsed.watched.length + i,
        type: "watchlist" as const,
        entry: e,
      })),
    ];

    setTotal(allItems.length);

    const autoWatched: MatchedWatchedItem[] = [];
    const autoWatchlist: MatchedWatchlistItem[] = [];
    /** Rows with low / no TMDB confidence — skip import (unlikely to resolve manually at scale). */
    let skippedUnmatched = 0;

    try {
      for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
        const batch = allItems.slice(i, i + BATCH_SIZE);
        const results = await fetchMatchBatch(
          batch.map((b) => ({ title: b.title, year: b.year, index: b.index })),
        );

        for (let j = 0; j < results.length; j++) {
          const result = results[j] as MatchResult;
          const item = batch[j];

          if (result.confidence === "high" || result.confidence === "medium") {
            if (result.matched) {
              if (item.type === "watched") {
                const w = item.entry as LetterboxdWatchedEntry;
                autoWatched.push({
                  tmdbId: result.matched.tmdbId,
                  watchedDate: w.watchedDate,
                  rating: w.rating,
                  review: w.review,
                });
              } else {
                autoWatchlist.push({ tmdbId: result.matched.tmdbId });
              }
            }
          } else {
            skippedUnmatched += 1;
          }
        }

        setProgress(Math.min(i + BATCH_SIZE, allItems.length));
        if (i + BATCH_SIZE < allItems.length) {
          await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
        }
      }

      setPhase("done");
      onMatched({
        watched: autoWatched,
        watchlist: autoWatchlist,
        skippedCount: skippedUnmatched,
        likedFilmTitles: parsed.likedFilms.map((f) => f.title),
      });
    } catch (err) {
      setMatchError(err instanceof Error ? err.message : "Matching failed");
      setPhase("pending");
      hasStarted.current = false;
    }
  }, [parsed, onMatched]);

  useEffect(() => {
    runMatching();
  }, [runMatching]);

  // ── Matching progress UI ───────────────────────────────────────────────────
  if (phase === "matching") {
    const pct = total > 0 ? Math.round((progress / total) * 100) : 0;
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-8 py-8">
        <ImportRefreshWarning />
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
          <div className="text-center">
            <p className="text-lg font-medium text-white">Matching your films…</p>
            <p className="mt-1 text-sm text-zinc-400">
              {progress} / {total} films matched
            </p>
          </div>
        </div>
        <div className="w-full rounded-full bg-white/10">
          <div
            className="h-2 rounded-full bg-indigo-400 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-zinc-600 text-center">
          Searching TMDB for each film — this takes a moment for large libraries
        </p>
      </div>
    );
  }

  // ── Error UI ───────────────────────────────────────────────────────────────
  if (matchError) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-8">
        <div className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/20 p-4 w-full">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
          <div>
            <p className="font-medium text-red-300">Matching failed</p>
            <p className="mt-0.5 text-sm text-red-400/80">{matchError}</p>
          </div>
        </div>
        <button
          onClick={() => {
            hasStarted.current = false;
            setMatchError(null);
            runMatching();
          }}
          className="rounded-full bg-white/10 px-6 py-2.5 text-sm text-white hover:bg-white/15 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Pending / Done states (shouldn't render long) ──────────────────────────
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 py-12">
      <CheckCircle2 className="h-10 w-10 text-green-400" />
      <p className="text-zinc-300">Films matched. Preparing import…</p>
    </div>
  );
}
