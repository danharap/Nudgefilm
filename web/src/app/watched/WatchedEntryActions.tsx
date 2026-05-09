"use client";

import { markTVWatched, markWatched } from "@/app/actions/library";
import { TV_SEASON_OFFSET, TV_TMDB_OFFSET } from "@/lib/tmdb/constants";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type MovieRow = {
  tmdb_id: number;
};

type Props = {
  movie: MovieRow;
  initialRating: number | null;
  initialNotes: string | null;
};

const RATING_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

async function saveDiaryEntry(
  movie: MovieRow,
  rating: number | null,
  notes: string | null,
) {
  const id = movie.tmdb_id;
  if (id >= TV_SEASON_OFFSET) {
    throw new Error("Edit season logs from the show page for that season.");
  }
  if (id >= TV_TMDB_OFFSET) {
    await markTVWatched(id - TV_TMDB_OFFSET, rating, notes);
    return;
  }
  await markWatched(id, rating, notes);
}

export function WatchedEntryActions({ movie, initialRating, initialNotes }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState<number>(initialRating ?? 0);
  const [notes, setNotes] = useState(initialNotes ?? "");

  function onSave() {
    startTransition(async () => {
      try {
        await saveDiaryEntry(movie, rating > 0 ? rating : null, notes.trim() || null);
        setEditing(false);
        toast.success("Rating saved.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save.");
      }
    });
  }

  if (!editing) {
    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-zinc-500 underline-offset-2 transition hover:text-indigo-300 hover:underline"
        >
          {initialRating ? `Rated ${initialRating}/10 · Edit` : "Add rating / notes"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-white/[0.08] bg-black/20 p-3">
      <div>
        <p className="mb-1.5 text-xs text-zinc-500">Rating (tap to toggle)</p>
        <div className="flex flex-wrap gap-1.5">
          {RATING_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating((prev) => (prev === n ? 0 : n))}
              className={`h-8 w-8 rounded-lg border text-xs font-semibold transition ${
                rating === n
                  ? "border-indigo-400/40 bg-indigo-400/15 text-indigo-200"
                  : "border-white/[0.08] text-zinc-600 hover:border-white/20 hover:text-zinc-300"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <textarea
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes…"
        className="w-full resize-none rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-indigo-400/30 focus:ring-1 focus:ring-indigo-400/20 transition"
      />

      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={onSave}
          className="rounded-full bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setRating(initialRating ?? 0);
            setNotes(initialNotes ?? "");
          }}
          className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
