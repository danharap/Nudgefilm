"use client";

import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  removeFriend,
  sendFriendRequest,
} from "@/app/actions/social";
import type { FriendshipStatus } from "@/features/users/service";
import { useState, useTransition } from "react";

type Props = {
  targetId: string;
  initial: FriendshipStatus;
};

export function FriendButton({ targetId, initial }: Props) {
  const [status, setStatus] = useState<FriendshipStatus>(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(action: () => Promise<void>, next: FriendshipStatus) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        setStatus(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {status === "none" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => act(() => sendFriendRequest(targetId), "pending_sent")}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-indigo-400/30 hover:text-white disabled:opacity-50"
        >
          + Add friend
        </button>
      )}
      {status === "pending_sent" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => act(() => cancelFriendRequest(targetId), "none")}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-zinc-400 transition hover:border-red-400/30 hover:text-red-300 disabled:opacity-50"
        >
          Request sent · Cancel
        </button>
      )}
      {status === "pending_received" && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => act(() => acceptFriendRequest(targetId), "accepted")}
            className="rounded-full bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-300 disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => act(() => declineFriendRequest(targetId), "none")}
            className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      )}
      {status === "accepted" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => act(() => removeFriend(targetId), "none")}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-zinc-400 transition hover:border-red-400/30 hover:text-red-300 disabled:opacity-50"
        >
          Friends ✓ · Remove
        </button>
      )}
      {error ? (
        <p className="text-xs text-red-300/80" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
