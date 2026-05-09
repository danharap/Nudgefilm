"use server";

import { removeFromWatchlist, removeWatchlistEntry } from "@/app/actions/library";

export async function removeWatchlistEntryAction(watchlistRowId: number) {
  await removeWatchlistEntry(watchlistRowId);
}

/** Legacy form action — prefers watchlist row id when present. */
export async function removeWatchlistItem(formData: FormData) {
  const rowRaw = formData.get("watchlistId");
  if (rowRaw != null && String(rowRaw).trim() !== "") {
    const id = Number(rowRaw);
    if (Number.isFinite(id)) {
      await removeWatchlistEntry(id);
    }
    return;
  }
  const tmdbId = Number(formData.get("tmdbId"));
  if (!Number.isFinite(tmdbId)) return;
  await removeFromWatchlist(tmdbId);
}
