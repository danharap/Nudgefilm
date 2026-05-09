"use client";

import { removeWatchlistEntryAction } from "./actions";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function WatchlistRemoveButton({ watchlistRowId }: { watchlistRowId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await removeWatchlistEntryAction(watchlistRowId);
            router.refresh();
          } catch (e) {
            console.error(e);
            alert((e as Error).message ?? "Could not remove from watchlist.");
          }
        })
      }
      className="text-xs text-tertiary underline-offset-2 hover:text-primary hover:underline disabled:opacity-50"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
