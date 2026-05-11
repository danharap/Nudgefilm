"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function getAuthedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to use social features.");
  return { supabase, user };
}

function revalidateSocialUi() {
  revalidatePath("/friends");
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Profile editing
// ---------------------------------------------------------------------------

export async function updateProfile(payload: {
  username?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  profile_background_url?: string | null;
  is_public?: boolean;
  watchlist_public?: boolean;
}) {
  const { supabase, user } = await getAuthedUser();

  // Normalise username
  const clean: typeof payload = { ...payload };
  if (clean.username !== undefined) {
    clean.username = clean.username.trim().toLowerCase() || undefined;
    if (clean.username && !/^[a-z0-9_]{3,24}$/.test(clean.username)) {
      throw new Error(
        "Username must be 3–24 characters: lowercase letters, numbers, underscores only.",
      );
    }
  }
  if (clean.display_name !== undefined) {
    clean.display_name = clean.display_name.trim() || undefined;
  }
  if (clean.bio !== undefined) {
    clean.bio = clean.bio.trim();
    if (clean.bio.length > 160) throw new Error("Bio must be 160 characters or fewer.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") throw new Error("That username is already taken.");
    console.error("[social] updateProfile error:", error.code, error.message);
    throw new Error("Failed to save profile.");
  }
  revalidatePath("/profile");
}

/** Invalidate public username route after banner/backdrop/logo changes */
export async function revalidateUsernameProfile(username: string) {
  const u = username.trim().toLowerCase();
  if (!u || !/^[a-z0-9_]{3,24}$/.test(u)) return;
  revalidatePath(`/user/${u}`);
}

// ---------------------------------------------------------------------------
// Friend requests
// ---------------------------------------------------------------------------

export async function sendFriendRequest(addresseeId: string) {
  const { supabase, user } = await getAuthedUser();
  if (addresseeId === user.id) throw new Error("You can't add yourself.");

  const { error } = await supabase.from("friendships").insert({
    requester_id: user.id,
    addressee_id: addresseeId,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") throw new Error("Friend request already sent.");
    console.error("[social] sendFriendRequest:", error.code, error.message);
    throw new Error("Could not send friend request.");
  }
  revalidateSocialUi();
}

export async function acceptFriendRequest(requesterId: string) {
  const { supabase, user } = await getAuthedUser();

  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("requester_id", requesterId)
    .eq("addressee_id", user.id)
    .eq("status", "pending");

  if (error) {
    console.error("[social] acceptFriendRequest:", error.code, error.message);
    throw new Error("Could not accept request.");
  }
  revalidateSocialUi();
}

export async function declineFriendRequest(requesterId: string) {
  const { supabase, user } = await getAuthedUser();

  await supabase
    .from("friendships")
    .delete()
    .eq("requester_id", requesterId)
    .eq("addressee_id", user.id);

  revalidateSocialUi();
}

export async function removeFriend(friendId: string) {
  const { supabase, user } = await getAuthedUser();

  await supabase
    .from("friendships")
    .delete()
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`,
    );

  revalidateSocialUi();
}

export async function cancelFriendRequest(addresseeId: string) {
  const { supabase, user } = await getAuthedUser();

  await supabase
    .from("friendships")
    .delete()
    .eq("requester_id", user.id)
    .eq("addressee_id", addresseeId);

  revalidateSocialUi();
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
