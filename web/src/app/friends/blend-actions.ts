"use server";

import { createClient } from "@/lib/supabase/server";
import { getFriendBlendRecommendations } from "@/features/recommendations/blend";
import type { BlendResult } from "@/features/recommendations/blend";

export type BlendActionResult =
  | ({ ok: true } & BlendResult)
  | { ok: false; error: string };

/**
 * Server action: generate a friend Blend for the current user + a followed user.
 *
 * Guards:
 *  - Caller must be authenticated.
 *  - friendId must be a user the caller follows (prevents arbitrary profile scraping).
 *  - Friend's diary is read under existing RLS — only accessible if is_public = true.
 */
export async function getBlendRecommendations(
  friendId: string,
): Promise<BlendActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "You must be signed in to use Blend." };
    }

    if (friendId === user.id) {
      return { ok: false, error: "You can't blend with yourself." };
    }

    // Verify caller follows friendId (prevents arbitrary profile data access)
    const { data: followRow } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("following_id", friendId)
      .maybeSingle();

    if (!followRow) {
      return {
        ok: false,
        error: "You can only blend with people you follow.",
      };
    }

    const result = await getFriendBlendRecommendations(user.id, friendId);
    return { ok: true, ...result };
  } catch (e) {
    console.error("[blend-actions] getBlendRecommendations:", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
