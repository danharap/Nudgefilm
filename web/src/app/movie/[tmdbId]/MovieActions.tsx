"use client";

import {
  addToWatchlist,
  markWatched,
  removeFromWatchlist,
  removeFromWatched,
} from "@/app/actions/library";
import { Bookmark, Check, Eye, Play, Share2, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
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
  const [logged, setLogged] = useState(() => !!existing);

  useEffect(() => {
    setQueued(inWatchlist);
  }, [inWatchlist]);

  useEffect(() => {
    setLogged(!!existing);
  }, [existing]);

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

  const rateLabelValue = rating > 0 ? rating : Number(existing?.user_rating ?? 0);

  return (
    <div className="mt-10 space-y-3 rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(16,20,40,0.88),rgba(8,11,25,0.78))] p-3 shadow-[0_16px_40px_-24px_rgba(92,90,255,0.45)] backdrop-blur-md sm:p-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => setShowRateForm((p) => !p)}
          aria-label={showRateForm ? "Close rating form" : "Open rating and log form"}
          className={`group flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition duration-200 hover:-translate-y-0.5 disabled:opacity-50 ${
            showRateForm || logged
              ? "border-indigo-400/35 bg-indigo-500/15 text-indigo-100 shadow-[0_0_0_1px_rgba(99,102,241,0.25)]"
              : "border-white/10 bg-white/[0.02] text-zinc-200 hover:border-indigo-400/30 hover:bg-indigo-500/10"
          }`}
        >
          <Star
            className={`size-4 transition ${showRateForm || logged ? "fill-indigo-300 text-indigo-300" : "text-zinc-300 group-hover:text-indigo-300"}`}
          />
          <span>
            {!logged ? "Rate" : rateLabelValue > 0 ? `Rate ${rateLabelValue}` : "Rate"}
          </span>
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
          aria-label={queued ? "Remove from watchlist" : "Add to watchlist"}
          title={queued ? "Click to remove from watchlist" : "Add to watchlist"}
          className={`group flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition duration-200 hover:-translate-y-0.5 disabled:opacity-50 ${
            queued
              ? "border-indigo-400/35 bg-indigo-500/15 text-indigo-100 shadow-[0_0_0_1px_rgba(99,102,241,0.25)]"
              : "border-white/10 bg-white/[0.02] text-zinc-200 hover:border-indigo-400/30 hover:bg-indigo-500/10"
          }`}
        >
          <span className="relative inline-flex items-center justify-center">
            <Bookmark
              className={`size-4 transition-all duration-200 ${queued ? "fill-indigo-300 text-indigo-300" : "text-zinc-300 group-hover:text-indigo-300"}`}
            />
            {queued ? <Check className="absolute -right-1.5 -top-1.5 size-3 rounded-full bg-indigo-500 text-white p-0.5" /> : null}
          </span>
          <span>{queued ? "Saved" : "Watchlist"}</span>
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (logged) {
              setLogged(false);
              run(
                () => removeFromWatched(tmdbId),
                "Removed from diary.",
                () => {
                  setRating(0);
                  setNotes("");
                  setShowRateForm(false);
                },
                () => setLogged(true),
              );
            } else {
              setLogged(true);
              run(
                () => markWatched(tmdbId, rating > 0 ? rating : null, notes.trim() || null),
                "Added to diary.",
                undefined,
                () => setLogged(false),
              );
            }
          }}
          aria-label={logged ? "Remove from diary" : "Mark movie as watched"}
          title={logged ? "Click again to remove from your diary" : "Add to your diary"}
          className={`group flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition duration-200 hover:-translate-y-0.5 disabled:opacity-50 ${
            logged
              ? "border-indigo-400/35 bg-indigo-500/15 text-indigo-100 shadow-[0_0_0_1px_rgba(99,102,241,0.25)] hover:border-indigo-400/45"
              : "border-white/10 bg-white/[0.02] text-zinc-200 hover:border-indigo-400/30 hover:bg-indigo-500/10"
          }`}
        >
          <Eye
            className={`size-4 transition ${logged ? "text-indigo-300" : "text-zinc-300 group-hover:text-indigo-300"}`}
          />
          <span>{logged ? "Logged" : "Watched"}</span>
        </button>

        <Link
          href={similarHref}
          aria-label="Find similar movies"
          className="group flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm font-medium text-zinc-200 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-400/30 hover:bg-indigo-500/10"
        >
          <Sparkles className="size-4 text-zinc-300 transition group-hover:text-indigo-300" />
          <span>Similar</span>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {trailerUrl ? (
          <a
            href={trailerUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Watch trailer"
            className="group flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] px-2 py-2 text-xs font-medium text-zinc-200 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-400/30 hover:bg-indigo-500/10 sm:text-sm"
          >
            <Play className="size-3.5 text-zinc-300 transition group-hover:text-indigo-300 sm:size-4" />
            <span>Trailer</span>
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] px-2 py-2 text-xs font-medium text-zinc-500 sm:text-sm"
          >
            <Play className="size-3.5 sm:size-4" />
            <span>Trailer</span>
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
          aria-label="Copy share link"
          className="group flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] px-2 py-2 text-xs font-medium text-zinc-200 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-400/30 hover:bg-indigo-500/10 sm:text-sm"
        >
          <Share2 className="size-3.5 text-zinc-300 transition group-hover:text-indigo-300 sm:size-4" />
          <span>Share</span>
        </button>
      </div>

      {/* Rate / log form */}
      {showRateForm ? (
        <div className="space-y-4 rounded-2xl border border-indigo-400/25 bg-[linear-gradient(180deg,rgba(18,22,46,0.88),rgba(8,10,24,0.9))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm">
          <p className="text-sm font-medium text-zinc-300">
            {logged ? "Update your log" : "Log this film"}
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
                  aria-label={`Set rating to ${n}`}
                  className={`h-8 w-8 rounded-lg border text-xs font-semibold transition sm:h-9 sm:w-9 sm:text-sm ${
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
                  logged ? "Log updated." : "Movie logged to your diary.",
                  () => setShowRateForm(false),
                )
              }
              className="rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-indigo-400 disabled:opacity-60"
            >
              {isPending ? "Saving…" : logged ? "Update" : "Save"}
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
