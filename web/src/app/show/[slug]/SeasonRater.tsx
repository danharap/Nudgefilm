"use client";

import { markTVSeasonWatched } from "@/app/actions/library";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type ExistingEntry = { user_rating: number | null; notes: string | null } | null;

type Props = {
  seasonTmdbId: number;
  showTmdbId: number;
  showName: string;
  seasonName: string;
  posterPath: string | null;
  airDate: string | null;
  episodeRunTime: number | null;
  isLoggedIn: boolean;
  existing: ExistingEntry;
};

const RATING_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function SeasonRater({
  seasonTmdbId,
  showTmdbId,
  showName,
  seasonName,
  posterPath,
  airDate,
  episodeRunTime,
  isLoggedIn,
  existing,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [rating, setRating] = useState<number>(existing?.user_rating ?? 0);
  const [notes, setNotes] = useState(existing?.notes ?? "");

  function save() {
    if (!isLoggedIn) {
      toast.error("Sign in to rate seasons.");
      return;
    }
    startTransition(async () => {
      try {
        await markTVSeasonWatched(
          seasonTmdbId,
          showName,
          seasonName,
          posterPath,
          airDate,
          episodeRunTime,
          rating > 0 ? rating : null,
          notes.trim() || null,
          showTmdbId,
        );
        toast.success(existing ? "Season log updated." : `${seasonName} logged to your diary.`);
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="mt-3">
      {/* Trigger row */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (!isLoggedIn) {
              toast.error("Sign in to rate seasons.");
              return;
            }
            setOpen((p) => !p);
          }}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            existing
              ? "border border-indigo-400/30 bg-indigo-400/10 text-indigo-200 hover:bg-indigo-400/20"
              : "border border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-white"
          }`}
        >
          {existing?.user_rating != null
            ? `★ ${existing.user_rating}/10`
            : existing
            ? "Logged"
            : "Rate season"}
        </button>
        {existing && (
          <span className="text-[11px] text-zinc-600">
            {existing.user_rating != null ? "· rated" : "· logged"}
          </span>
        )}
      </div>

      {/* Inline rating form */}
      {open && (
        <div className="mt-3 rounded-xl border border-white/[0.08] bg-zinc-950/80 p-4 space-y-3">
          <p className="text-xs font-medium text-zinc-300">
            {existing ? `Update ${seasonName}` : `Rate ${seasonName}`}
          </p>

          <div className="space-y-1.5">
            <p className="text-[11px] text-zinc-600">Rating (optional)</p>
            <div className="flex flex-wrap gap-1">
              {RATING_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating((prev) => (prev === n ? 0 : n))}
                  className={`h-8 w-8 rounded-lg border text-xs font-semibold transition ${
                    rating === n
                      ? "border-indigo-400/40 bg-indigo-400/15 text-indigo-200"
                      : "border-white/[0.08] text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-zinc-600">Notes (optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Thoughts on this season…"
              className="w-full resize-none rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-indigo-400/30 focus:ring-1 focus:ring-indigo-400/20 transition"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={save}
              className="rounded-lg bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-60"
            >
              {isPending ? "Saving…" : existing ? "Update" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
