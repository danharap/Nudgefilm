"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function getAuthedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to manage lists.");
  return { supabase, user };
}

// ---------------------------------------------------------------------------
// Profile Lists
// ---------------------------------------------------------------------------

export async function createProfileList(input: {
  name: string;
  emoji?: string;
  description?: string;
  is_public?: boolean;
}) {
  const { supabase, user } = await getAuthedUser();

  const name = input.name.trim();
  if (!name || name.length > 60) throw new Error("List name must be 1–60 characters.");

  // Append at end: find current max position
  const { data: existing } = await supabase
    .from("profile_lists")
    .select("position")
    .eq("user_id", user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (existing?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("profile_lists")
    .insert({
      user_id: user.id,
      name,
      emoji: input.emoji?.trim() || null,
      description: input.description?.trim() || null,
      is_public: input.is_public ?? true,
      position,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[lists] createProfileList:", error.code, error.message);
    throw new Error("Could not create list.");
  }

  revalidatePath("/profile");
  return data.id as string;
}

export async function updateProfileList(
  listId: string,
  input: {
    name?: string;
    emoji?: string | null;
    description?: string | null;
    is_public?: boolean;
    position?: number;
  },
) {
  const { supabase, user } = await getAuthedUser();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (!n || n.length > 60) throw new Error("List name must be 1–60 characters.");
    patch.name = n;
  }
  if (input.emoji !== undefined) patch.emoji = input.emoji?.trim() || null;
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.is_public !== undefined) patch.is_public = input.is_public;
  if (input.position !== undefined) patch.position = input.position;

  const { error } = await supabase
    .from("profile_lists")
    .update(patch)
    .eq("id", listId)
    .eq("user_id", user.id);

  if (error) {
    console.error("[lists] updateProfileList:", error.code, error.message);
    throw new Error("Could not update list.");
  }

  revalidatePath("/profile");
}

export async function deleteProfileList(listId: string) {
  const { supabase, user } = await getAuthedUser();

  const { error } = await supabase
    .from("profile_lists")
    .delete()
    .eq("id", listId)
    .eq("user_id", user.id);

  if (error) {
    console.error("[lists] deleteProfileList:", error.code, error.message);
    throw new Error("Could not delete list.");
  }

  revalidatePath("/profile");
}

export async function addMovieToList(listId: string, movieId: number) {
  const { supabase, user } = await getAuthedUser();

  // Verify list ownership
  const { data: list } = await supabase
    .from("profile_lists")
    .select("id")
    .eq("id", listId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!list) throw new Error("List not found.");

  // Append at end
  const { data: last } = await supabase
    .from("profile_list_movies")
    .select("position")
    .eq("list_id", listId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (last?.position ?? -1) + 1;

  const { error } = await supabase.from("profile_list_movies").insert({
    list_id: listId,
    movie_id: movieId,
    position,
  });

  if (error) {
    if (error.code === "23505") throw new Error("Movie already in this list.");
    console.error("[lists] addMovieToList:", error.code, error.message);
    throw new Error("Could not add movie.");
  }

  revalidatePath("/profile");
}

export async function removeMovieFromList(listId: string, movieId: number) {
  const { supabase, user } = await getAuthedUser();

  // Verify list ownership
  const { data: list } = await supabase
    .from("profile_lists")
    .select("id")
    .eq("id", listId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!list) throw new Error("List not found.");

  const { error } = await supabase
    .from("profile_list_movies")
    .delete()
    .eq("list_id", listId)
    .eq("movie_id", movieId);

  if (error) {
    console.error("[lists] removeMovieFromList:", error.code, error.message);
    throw new Error("Could not remove movie.");
  }

  revalidatePath("/profile");
}

// ---------------------------------------------------------------------------
// Follows
// ---------------------------------------------------------------------------

export async function followUser(targetId: string) {
  const { supabase, user } = await getAuthedUser();
  if (targetId === user.id) throw new Error("You can't follow yourself.");

  const { error } = await supabase.from("follows").insert({
    follower_id: user.id,
    following_id: targetId,
  });

  if (error) {
    if (error.code === "23505") return; // already following, silent
    console.error("[lists] followUser:", error.code, error.message);
    throw new Error("Could not follow user.");
  }

  revalidatePath("/profile");
  revalidatePath("/friends");
  revalidatePath("/", "layout");
}

export async function unfollowUser(targetId: string) {
  const { supabase, user } = await getAuthedUser();

  await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", targetId);

  revalidatePath("/profile");
  revalidatePath("/friends");
  revalidatePath("/", "layout");
}
