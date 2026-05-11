"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function getAuthedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required.");
  return { supabase, user };
}

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

export type UpdateProfilePayload = {
  username?: string;
  display_name?: string;
  bio?: string | null;
  is_public?: boolean;
  watchlist_public?: boolean;
  avatar_url?: string | null;
  banner_url?: string | null;
  profile_background_url?: string | null;
};

/** Persist profile fields for the signed-in user (edit profile, avatar/banner uploads). */
export async function updateProfile(payload: UpdateProfilePayload): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: current } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  const previousUsername = (current?.username as string | null | undefined)?.trim() ?? null;

  const row: Record<string, unknown> = {};

  if (payload.display_name !== undefined) {
    row.display_name = payload.display_name?.trim() || null;
  }
  if (payload.bio !== undefined) {
    row.bio = payload.bio;
  }
  if (payload.is_public !== undefined) row.is_public = payload.is_public;
  if (payload.watchlist_public !== undefined) row.watchlist_public = payload.watchlist_public;
  if (payload.avatar_url !== undefined) row.avatar_url = payload.avatar_url;
  if (payload.banner_url !== undefined) row.banner_url = payload.banner_url;
  if (payload.profile_background_url !== undefined) {
    row.profile_background_url = payload.profile_background_url;
  }

  if (payload.username !== undefined) {
    const normalized = payload.username.trim().toLowerCase();
    if (!USERNAME_RE.test(normalized)) {
      throw new Error(
        "Username must be 3–24 characters: lowercase letters, numbers, or underscores only.",
      );
    }
    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", normalized)
      .neq("id", user.id)
      .maybeSingle();
    if (taken) throw new Error("That username is already taken.");
    row.username = normalized;
  }

  if (Object.keys(row).length === 0) return;

  const { error } = await supabase.from("profiles").update(row).eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/profile");
  revalidatePath("/settings");
  revalidatePath("/", "layout");

  const newUsername =
    typeof row.username === "string"
      ? row.username
      : previousUsername ?? undefined;
  if (previousUsername && row.username !== undefined && previousUsername !== row.username) {
    revalidatePath(`/user/${previousUsername}`);
  }
  if (newUsername) {
    revalidatePath(`/user/${newUsername}`);
  }
}

/** Invalidate cached public profile page after banner/avatar/etc. changes. */
export async function revalidateUsernameProfile(username: string): Promise<void> {
  const u = username.trim();
  if (!u) return;
  revalidatePath(`/user/${u}`);
}

/** Call when the user opens the social inbox; new follows after this moment surface on the badge. */
export async function markSocialInboxRead(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("profiles")
    .update({ social_inbox_last_read_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    console.error("[social] markSocialInboxRead:", error.message);
    return { ok: false };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/** Stamps follows_seen_at so new-follower badge resets to 0. */
export async function markNotificationsSeen() {
  const { supabase, user } = await getAuthedUser();
  await supabase
    .from("profiles")
    .update({ follows_seen_at: new Date().toISOString() })
    .eq("id", user.id);
  revalidatePath("/", "layout");
}
