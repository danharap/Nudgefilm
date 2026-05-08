"use client";

import { addToWatchlist, markWatched, removeFromWatchlist } from "@/app/actions/library";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type ExistingEntry = {
  user_rating: number | null;
  notes: string | null;
} | null;

type Props = {
  tmdbId: number;
  isLoggedIn: boolean;
  existing: ExistingEntry;
  inWatchlist: boolean;
  similarHref: string;
  trailerUrl?: string | null;
  shareUrl: string;
};

const RATING_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function MovieActions({
  tmdbId,
  isLoggedIn,
  existing,
  inWatchlist,
  similarHref,
  trailerUrl,
  shareUrl,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showRateForm, setShowRateForm] = useState(false);
  const [rating, setRating] = useState<number>(existing?.user_rating ?? 0);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [queued, setQueued] = useState(inWatchlist);

  function run(
    action: () => Promise<void>,
    successMsg = "Saved.",
    onSuccess?: () => void,
    onError?: () => void,
  ) {
    startTransition(async () => {
      try {
        await action();
        toast.success(successMsg);
        onSuccess?.();
        router.refresh();
      } catch (e) {
        onError?.();
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (!isLoggedIn) {
    return (
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3 md:justify-start">
        <Link
          href={`/login?redirect=/movie/${tmdbId}`}
          className="rounded-full bg-indigo-500/15 px-5 py-2.5 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/25"
        >
          Sign in to log / rate
        </Link>
        <Link
          href={similarHref}
          className="rounded-full px-5 py-2.5 text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          Find similar
        </Link>
        {trailerUrl ? (
          <a
            href={trailerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-zinc-300 transition hover:border-indigo-400/30 hover:text-white"
          >
            Watch trailer
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-10 space-y-4 rounded-2xl border border-white/10 bg-[var(--surface-1)]/70 p-4 backdrop-blur-sm sm:p-5">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() => setShowRateForm((p) => !p)}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
            existing
              ? "border border-indigo-400/30 bg-indigo-400/10 text-indigo-200 hover:bg-indigo-400/20"
              : "bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25"
          }`}
        >
          {existing
            ? `Logged · ${existing.user_rating ? `${existing.user_rating}/10` : "no rating"}`
            : "Log / Rate"}
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (queued) {
              setQueued(false);
              run(
                () => removeFromWatchlist(tmdbId),
                "Removed from watchlist.",
                undefined,
                () => setQueued(true),
              );
            } else {
              setQueued(true);
              run(
                () => addToWatchlist(tmdbId),
                "Added to watchlist.",
                undefined,
                () => setQueued(false),
              );
            }
          }}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
            queued
              ? "border border-indigo-400/30 bg-indigo-400/10 text-indigo-200 hover:bg-indigo-400/20"
              : "border border-white/10 text-zinc-300 hover:border-indigo-400/30 hover:text-white"
          }`}
        >
          {queued ? "✓ In watchlist · Remove" : "Watchlist"}
        </button>

        <Link
          href={similarHref}
          className="rounded-xl border border-white/10 px-4 py-2.5 text-center text-sm text-zinc-300 transition hover:border-indigo-400/30 hover:text-white"
        >
          Find similar
        </Link>
        {trailerUrl ? (
          <a
            href={trailerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-white/10 px-4 py-2.5 text-center text-sm text-zinc-300 transition hover:border-indigo-400/30 hover:text-white"
          >
            Watch trailer
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="rounded-xl border border-white/10 px-4 py-2.5 text-center text-sm text-zinc-500"
          >
            No trailer
          </button>
        )}
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(shareUrl);
              toast.success("Link copied.");
            } catch {
              toast.error("Could not copy link.");
            }
          }}
          className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-indigo-400/30 hover:text-white"
        >
          Share
        </button>
      </div>

      {/* Rate / log form */}
      {showRateForm ? (
        <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/70 p-5 space-y-4 backdrop-blur-sm">
          <p className="text-sm font-medium text-zinc-300">
            {existing ? "Update your log" : "Log this film"}
          </p>

          {/* 1–10 rating */}
          <div className="space-y-2">
            <p className="text-xs text-zinc-500">Your rating (optional)</p>
            <div className="flex flex-wrap gap-1.5">
              {RATING_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating((prev) => (prev === n ? 0 : n))}
                  className={`h-9 w-9 rounded-lg border text-sm font-semibold transition ${
                    rating === n
                      ? "border-indigo-400/40 bg-indigo-400/15 text-indigo-200"
                      : "border-white/[0.08] text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-xs text-indigo-300/70">
                {rating}/10 selected
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label htmlFor="movie-notes" className="text-xs text-zinc-500">
              Notes (optional)
            </label>
            <textarea
              id="movie-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Thoughts, watch date, who you watched with…"
              className="w-full resize-none rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-indigo-400/30 focus:ring-2 focus:ring-indigo-400/20 transition"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                run(
                  () =>
                    markWatched(
                      tmdbId,
                      rating > 0 ? rating : null,
                      notes.trim() || null,
                    ),
                  existing ? "Log updated." : "Movie logged to your diary.",
                  () => setShowRateForm(false),
                )
              }
              className="rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-60"
            >
              {isPending ? "Saving…" : existing ? "Update" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setShowRateForm(false)}
              className="rounded-full border border-white/10 px-4 py-2.5 text-sm text-zinc-400 transition hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
