"use client";

import { markSocialInboxRead } from "@/app/actions/social";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Persists “inbox read” server-side and refreshes RSC so the header badge matches. */
export function MarkSocialInboxSeen() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    void markSocialInboxRead().then(() => {
      if (!cancelled) router.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [router]);
  return null;
}
