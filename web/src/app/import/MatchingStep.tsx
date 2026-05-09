"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CheckCircle2, XCircle, HelpCircle, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import type { ParsedImport, LetterboxdWatchedEntry, LetterboxdWatchlistEntry } from "@/lib/letterboxd/parser";
import type { MatchResult, MatchCandidate } from "@/app/api/import/match/route";

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

type Phase = "pending" | "matching" | "confirming" | "done";

interface PendingConfirmation {
  entry: LetterboxdWatchedEntry | LetterboxdWatchlistEntry;
  type: "watched" | "watchlist";
  originalResult: MatchResult;
}

const BATCH_SIZE = 45;
const BATCH_DELAY_MS = 80;

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w92";

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
  const [autoMatchedWatched, setAutoMatchedWatched] = useState<MatchedWatchedItem[]>([]);
  const [autoMatchedWatchlist, setAutoMatchedWatchlist] = useState<MatchedWatchlistItem[]>([]);
  const [pendingConfirmations, setPendingConfirmations] = useState<PendingConfirmation[]>([]);
  const [confirmIndex, setConfirmIndex] = useState(0);
  const [confirmedWatched, setConfirmedWatched] = useState<MatchedWatchedItem[]>([]);
  const [confirmedWatchlist, setConfirmedWatchlist] = useState<MatchedWatchlistItem[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
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
    const needsConfirmation: PendingConfirmation[] = [];

    try {
      for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
        const batch = allItems.slice(i, i + BATCH_SIZE);
        const results = await fetchMatchBatch(
          batch.map((b) => ({ title: b.title, year: b.year, index: b.index })),
        );

        for (let j = 0; j < results.length; j++) {
          const result = results[j];
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
            needsConfirmation.push({
              entry: item.entry,
              type: item.type,
              originalResult: result,
            });
          }
        }

        setProgress(Math.min(i + BATCH_SIZE, allItems.length));
        if (i + BATCH_SIZE < allItems.length) {
          await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
        }
      }

      setAutoMatchedWatched(autoWatched);
      setAutoMatchedWatchlist(autoWatchlist);
      setPendingConfirmations(needsConfirmation);

      if (needsConfirmation.length === 0) {
        setPhase("done");
        onMatched({
          watched: autoWatched,
          watchlist: autoWatchlist,
          skippedCount: 0,
          likedFilmTitles: parsed.likedFilms.map((f) => f.title),
        });
      } else {
        setPhase("confirming");
        setConfirmIndex(0);
      }
    } catch (err) {
      setMatchError(err instanceof Error ? err.message : "Matching failed");
      setPhase("pending");
      hasStarted.current = false;
    }
  }, [parsed, onMatched]);

  useEffect(() => {
    runMatching();
  }, [runMatching]);

  const handleConfirm = (candidate: MatchCandidate) => {
    const item = pendingConfirmations[confirmIndex];
    if (item.type === "watched") {
      const w = item.entry as LetterboxdWatchedEntry;
      setConfirmedWatched((prev) => [
        ...prev,
        {
          tmdbId: candidate.tmdbId,
          watchedDate: w.watchedDate,
          rating: w.rating,
          review: w.review,
        },
      ]);
    } else {
      setConfirmedWatchlist((prev) => [...prev, { tmdbId: candidate.tmdbId }]);
    }
    advance();
  };

  const handleSkip = () => {
    setSkippedCount((c) => c + 1);
    advance();
  };

  const advance = () => {
    const next = confirmIndex + 1;
    if (next >= pendingConfirmations.length) {
      setPhase("done");
      onMatched({
        watched: [...autoMatchedWatched, ...confirmedWatched],
        watchlist: [...autoMatchedWatchlist, ...confirmedWatchlist],
        skippedCount: skippedCount + 1,
        likedFilmTitles: parsed.likedFilms.map((f) => f.title),
      });
    } else {
      setConfirmIndex(next);
    }
  };

  const skipAll = () => {
    setSkippedCount((c) => c + pendingConfirmations.length - confirmIndex);
    setPhase("done");
    onMatched({
      watched: [...autoMatchedWatched, ...confirmedWatched],
      watchlist: [...autoMatchedWatchlist, ...confirmedWatchlist],
      skippedCount: skippedCount + pendingConfirmations.length - confirmIndex,
      likedFilmTitles: parsed.likedFilms.map((f) => f.title),
    });
  };

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

  // ── Confirmation UI ────────────────────────────────────────────────────────
  if (phase === "confirming") {
    const item = pendingConfirmations[confirmIndex];
    const { originalResult } = item;
    const remaining = pendingConfirmations.length - confirmIndex;

    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <ImportRefreshWarning />
        <div className="text-center">
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-600">
            {confirmIndex + 1} of {pendingConfirmations.length} uncertain matches
          </div>
          <h2 className="text-xl font-semibold text-white">Help us find this film</h2>
          <p className="mt-1 text-sm text-zinc-400">
            We couldn&apos;t automatically match{" "}
            <strong className="text-zinc-300">{originalResult.title}</strong>
            {originalResult.year ? ` (${originalResult.year})` : ""}
          </p>
        </div>

        {/* Confidence badge */}
        <div className="flex justify-center">
          {originalResult.confidence === "low" ? (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-indigo-400">
              <HelpCircle className="h-3.5 w-3.5" />
              Possible match found — please verify
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300">
              <XCircle className="h-3.5 w-3.5" />
              No automatic match
            </span>
          )}
        </div>

        {/* Candidate cards */}
        {originalResult.candidates.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-zinc-600 mb-1">Select the correct film:</p>
            {originalResult.candidates.map((c) => (
              <button
                key={c.tmdbId}
                onClick={() => handleConfirm(c)}
                className="flex w-full items-center gap-4 rounded-xl bg-white/5 p-3 text-left transition hover:bg-white/10 hover:ring-1 hover:ring-amber-300/30"
              >
                <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-zinc-800">
                  {c.posterPath ? (
                    <Image
                      src={`${TMDB_IMAGE_BASE}${c.posterPath}`}
                      alt={c.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="text-zinc-600 text-xs">?</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{c.title}</p>
                  <p className="text-xs text-zinc-500">
                    {c.year ?? "Unknown year"} · ★ {c.voteAverage.toFixed(1)}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-600 shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-white/5 p-6 text-center text-sm text-zinc-500">
            No candidates found in TMDB for this title.
          </div>
        )}

        {/* Skip actions */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={handleSkip}
            className="rounded-full px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition"
          >
            Skip this film
          </button>
          {remaining > 1 && (
            <button
              onClick={skipAll}
              className="rounded-full px-4 py-2 text-sm text-zinc-600 hover:text-zinc-400 transition"
            >
              Skip all {remaining} unmatched
            </button>
          )}
        </div>
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
