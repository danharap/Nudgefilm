"use server";

import { createClient } from "@/lib/supabase/server";
import { getAppOriginAsync } from "@/lib/site-url";
import { redirect } from "next/navigation";

export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("redirect") ?? "/");
  const next = nextRaw.startsWith("/") ? nextRaw : "/";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect(next);
}

export async function signInWithGoogle(formData: FormData) {
  const nextRaw = String(formData.get("redirect") ?? "/auth/post-login");
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//")
      ? nextRaw
      : "/auth/post-login";

  const origin = await getAppOriginAsync();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error || !data?.url) {
    const message = error?.message || "Unable to start Google sign-in.";
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  redirect(data.url);
}

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

export async function signUpWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();

  // Carry user-typed values through validation redirects so they don't retype.
  const reentry =
    `&displayName=${encodeURIComponent(displayName)}` +
    `&username=${encodeURIComponent(username)}` +
    `&email=${encodeURIComponent(email)}`;

  if (!displayName) {
    redirect(
      `/signup?error=${encodeURIComponent("Add a display name so people know who you are.")}${reentry}`,
    );
  }
  if (!username) {
    redirect(
      `/signup?error=${encodeURIComponent("Pick a username so friends can find you.")}${reentry}`,
    );
  }
  if (!USERNAME_RE.test(username)) {
    redirect(
      `/signup?error=${encodeURIComponent(
        "Username must be 3–24 characters: lowercase letters, numbers, or underscores only.",
      )}${reentry}`,
    );
  }

  const supabase = await createClient();

  // Pre-check uniqueness so we can give a clear error before invoking auth.
  // (RLS allows reading public profiles; the unique constraint is the source of truth.)
  const { data: takenRow } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (takenRow) {
    redirect(
      `/signup?error=${encodeURIComponent(
        "That username is already taken — try another.",
      )}${reentry}`,
    );
  }

  const origin = await getAppOriginAsync();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Confirm in app, then send to login (must sign in) — onboarding after login
      emailRedirectTo: `${origin}/auth/callback?post_verify=login`,
      data: { display_name: displayName, username },
    },
  });
  if (error) {
    // Race: someone else grabbed the username between pre-check and trigger insert.
    const lower = error.message.toLowerCase();
    const looksLikeUsernameClash =
      lower.includes("duplicate") ||
      lower.includes("unique") ||
      lower.includes("database error saving new user");
    const friendly = looksLikeUsernameClash
      ? "That username was just taken. Please pick a different one."
      : error.message;
    redirect(`/signup?error=${encodeURIComponent(friendly)}${reentry}`);
  }
  redirect("/signup?message=check_email");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
