"use client";

import { followUser, unfollowUser } from "@/app/actions/lists";
import { useState, useTransition } from "react";

export function FollowButton({
  targetId,
  initialFollowing,
}: {
  targetId: string;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [isPending, startTransition] = useTransition();
  const [isHovering, setIsHovering] = useState(false);

  function toggle() {
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      try {
        if (next) {
          await followUser(targetId);
        } else {
          await unfollowUser(targetId);
        }
      } catch {
        setFollowing(!next); // revert on error
      }
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
        following
          ? "border border-[var(--surface-border)] bg-[var(--surface-2)] text-secondary hover:border-red-400/40 hover:bg-red-900/20 hover:text-red-300"
          : "btn-brand"
      }`}
    >
      {following ? (isHovering ? "Unfollow" : "Following") : "Follow"}
    </button>
  );
}
