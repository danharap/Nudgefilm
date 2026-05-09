"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { CheckCircle2, Film, List, XCircle, Loader2, AlertCircle, Heart, AlertTriangle } from "lucide-react";
import type { MatchedData } from "./MatchingStep";
import type { SaveResponseBody } from "@/app/api/import/save/route";

interface SummaryStepProps {
  matchedData: MatchedData;
  onStartOver: () => void;
}

type Phase =
  | "checking"       // counting duplicates
  | "conflict"       // showing overwrite/skip prompt
  | "saving"         // writing to DB
  | "done"           // complete
  | "error";

const SAVE_CHUNK = 80;

function emptySaveStats(): SaveResponseBody {
  return {
    watchedImported: 0,
    watchedSkipped: 0,
    watchedDuplicates: 0,
    watchlistImported: 0,
    watchlistSkipped: 0,
    errors: [],
  };
}

function mergeSaveStats(a: SaveResponseBody, b: SaveResponseBody): SaveResponseBody {
  return {
    watchedImported: a.watchedImported + b.watchedImported,
    watchedSkipped: a.watchedSkipped + b.watchedSkipped,
    watchedDuplicates: a.watchedDuplicates + b.watchedDuplicates,
    watchlistImported: a.watchlistImported + b.watchlistImported,
    watchlistSkipped: a.watchlistSkipped + b.watchlistSkipped,
    errors: [...a.errors, ...b.errors],
  };
}

export function SummaryStep({ matchedData, onStartOver }: SummaryStepProps) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveResult, setSaveResult] = useState<SaveResponseBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasChecked = useRef(false);

  // Step 1: check for duplicates
  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    const check = async () => {
      try {
        const res = await fetch("/api/import/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            watched: matchedData.watched,
            watchlist: [],
            mode: "check",
          }),
        });
        const data: SaveResponseBody = await res.json();
        const dupes = data.watchedDuplicates ?? 0;
        setDuplicateCount(dupes);
        // If no duplicates, go straight to saving
        if (dupes === 0) {
          runSave("overwrite");
        } else {
          setPhase("conflict");
        }
      } catch {
        // If check fails, proceed anyway
        runSave("overwrite");
      }
    };

    check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSave = async (mode: "overwrite" | "skip") => {
    setPhase("saving");
    const total = matchedData.watched.length + matchedData.watchlist.length;
    setSaveProgress(0);

    try {
      let aggregated = emptySaveStats();
      let done = 0;

      for (let i = 0; i < matchedData.watched.length; i += SAVE_CHUNK) {
        const chunk = matchedData.watched.slice(i, i + SAVE_CHUNK);
        const res = await fetch("/api/import/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            watched: chunk,
            watchlist: [],
            mode,
          }),
        });
        if (!res.ok) throw new Error(`Save failed: ${res.statusText}`);
        const part: SaveResponseBody = await res.json();
        aggregated = mergeSaveStats(aggregated, part);
        done += chunk.length;
        setSaveProgress(Math.min(done, total));
      }

      for (let i = 0; i < matchedData.watchlist.length; i += SAVE_CHUNK) {
        const chunk = matchedData.watchlist.slice(i, i + SAVE_CHUNK);
        const res = await fetch("/api/import/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            watched: [],
            watchlist: chunk,
            mode,
          }),
        });
        if (!res.ok) throw new Error(`Save failed: ${res.statusText}`);
        const part: SaveResponseBody = await res.json();
        aggregated = mergeSaveStats(aggregated, part);
        done += chunk.length;
        setSaveProgress(Math.min(done, total));
      }

      setSaveProgress(total);
      setSaveResult(aggregated);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setPhase("error");
    }
  };

  // ── Checking duplicates ────────────────────────────────────────────────────
  if (phase === "checking") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        <p className="text-sm text-zinc-400">Checking for existing films…</p>
      </div>
    );
  }

  // ── Conflict prompt ────────────────────────────────────────────────────────
  if (phase === "conflict") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10">
            <AlertTriangle className="h-7 w-7 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">
              {duplicateCount} film{duplicateCount !== 1 ? "s" : ""} already in your library
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              How do you want to handle movies you&apos;ve already logged?
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => runSave("overwrite")}
            className="flex w-full flex-col gap-1 rounded-xl bg-indigo-500/10 p-4 text-left ring-1 ring-indigo-400/20 transition hover:bg-indigo-400/15"
          >
            <span className="font-semibold text-indigo-300">Overwrite existing</span>
            <span className="text-sm text-zinc-400">
              Update ratings, dates, and notes for all {duplicateCount} existing films.
              Recommended if you&apos;re doing a fresh re-import to fix ratings.
            </span>
          </button>

          <button
            onClick={() => runSave("skip")}
            className="flex w-full flex-col gap-1 rounded-xl bg-white/5 p-4 text-left ring-1 ring-white/10 transition hover:bg-white/10"
          >
            <span className="font-semibold text-white">Skip duplicates</span>
            <span className="text-sm text-zinc-400">
              Only add films not already in your library. Leave existing entries as they are.
            </span>
          </button>
        </div>

        <p className="text-center text-xs text-zinc-600">
          {matchedData.watched.length} total films to import ·{" "}
          {matchedData.watched.length - duplicateCount} are new
        </p>
      </div>
    );
  }

  // ── Saving progress ────────────────────────────────────────────────────────
  if (phase === "saving") {
    const total = matchedData.watched.length + matchedData.watchlist.length;
    const pct = total > 0 ? Math.round((saveProgress / total) * 100) : 0;

    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-8 py-8">
        <div className="w-full rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
          Don&apos;t refresh or close this tab while saving — the import may stop partway.
        </div>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
          <div className="text-center">
            <p className="text-lg font-medium text-white">Saving your library…</p>
            <p className="mt-1 text-sm text-zinc-400">
              {matchedData.watched.length} films + {matchedData.watchlist.length} watchlist
            </p>
          </div>
        </div>
        <div className="w-full rounded-full bg-white/10">
          <div
            className="h-2 rounded-full bg-indigo-400 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-8">
        <div className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/20 p-4 w-full">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
          <div>
            <p className="font-medium text-red-300">Import failed</p>
            <p className="mt-0.5 text-sm text-red-400/80">{error}</p>
          </div>
        </div>
        <button
          onClick={() => {
            hasChecked.current = false;
            setPhase("checking");
            setError(null);
          }}
          className="rounded-full bg-white/10 px-6 py-2.5 text-sm text-white hover:bg-white/15 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  const r = saveResult!;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
      {/* Success header */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
          <CheckCircle2 className="h-8 w-8 text-green-400" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-white">Import complete!</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Your Letterboxd history has been added to your library.
          </p>
          {matchedData.skippedCount > 0 ? (
            <p className="mt-3 max-w-md text-xs leading-relaxed text-zinc-500">
              {matchedData.skippedCount} title{matchedData.skippedCount !== 1 ? "s" : ""} couldn&apos;t
              be matched reliably on TMDB and were skipped. You can add those manually from{" "}
              <Link href="/browse" className="text-indigo-400/90 underline hover:text-indigo-300">
                Browse
              </Link>{" "}
              if you want them in your diary.
            </p>
          ) : null}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Film className="h-5 w-5 text-indigo-400" />}
          value={r.watchedImported}
          label="Films imported"
          highlight
        />
        <StatCard
          icon={<List className="h-5 w-5 text-zinc-400" />}
          value={r.watchlistImported}
          label="Watchlist added"
        />
        {r.watchedDuplicates > 0 ? (
          <StatCard
            icon={<XCircle className="h-5 w-5 text-zinc-600" />}
            value={r.watchedDuplicates}
            label="Duplicates skipped"
          />
        ) : null}
        {matchedData.skippedCount > 0 ? (
          <StatCard
            icon={<XCircle className="h-5 w-5 text-amber-600/80" />}
            value={matchedData.skippedCount}
            label="No TMDB match"
          />
        ) : null}
        {matchedData.likedFilmTitles.length > 0 && (
          <StatCard
            icon={<Heart className="h-5 w-5 text-rose-400" />}
            value={matchedData.likedFilmTitles.length}
            label="Liked films"
          />
        )}
      </div>

      {/* Liked films note */}
      {matchedData.likedFilmTitles.length > 0 && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/15 p-4 text-sm text-rose-300">
          <strong>Liked films tip:</strong> You had {matchedData.likedFilmTitles.length} liked
          films on Letterboxd. Visit your{" "}
          <Link href="/profile" className="underline hover:text-rose-200">
            profile
          </Link>{" "}
          to pin up to 4 as your favourites.
        </div>
      )}

      {/* Non-fatal errors */}
      {r.errors && r.errors.length > 0 && (
        <details className="rounded-xl bg-white/5 p-4">
          <summary className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-400">
            {r.errors.length} films couldn&apos;t be saved
          </summary>
          <ul className="mt-3 space-y-1">
            {r.errors.slice(0, 20).map((e, i) => (
              <li key={i} className="text-xs text-zinc-600">{e}</li>
            ))}
          </ul>
        </details>
      )}

      {/* CTAs */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/watched"
          className="flex-1 rounded-full bg-indigo-500 px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-indigo-300"
        >
          View my watched films →
        </Link>
        <Link
          href="/watchlist"
          className="flex-1 rounded-full bg-white/10 px-6 py-3 text-center text-sm text-white transition hover:bg-white/15"
        >
          View watchlist
        </Link>
      </div>

      <button
        onClick={onStartOver}
        className="text-center text-xs text-zinc-600 hover:text-zinc-400 transition"
      >
        Start a new import
      </button>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  highlight = false,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-xl p-4 text-center ${
        highlight ? "bg-indigo-500/10 ring-1 ring-indigo-400/20" : "bg-white/5"
      }`}
    >
      {icon}
      <div className={`text-2xl font-bold ${highlight ? "text-indigo-400" : "text-white"}`}>
        {value.toLocaleString()}
      </div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}
