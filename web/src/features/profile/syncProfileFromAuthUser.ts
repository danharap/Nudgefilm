import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

function usernameSeedFromText(value: string | null | undefined): string {
  const input = (value ?? "").trim().toLowerCase();
  if (!input) return "";
  const cleaned = input
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return cleaned.slice(0, 24);
}

function ensureUsernameFormat(seed: string, email: string | null): string {
  let base = usernameSeedFromText(seed);
  if (!base && email) base = usernameSeedFromText(email.split("@")[0]);
  if (!base) base = "filmfan";
  if (base.length < 3) base = `${base}${"fan".slice(0, 3 - base.length)}`;
  return base.slice(0, 24);
}

async function isUsernameTakenByOther(
  supabase: SupabaseClient,
  username: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", userId)
    .maybeSingle();
  return data != null;
}

/** Picks a username matching USERNAME_RE, appending _2, _3, … until free (exact DB check). */
async function pickAvailableUsername(
  supabase: SupabaseClient,
  userId: string,
  preferredSeed: string,
  email: string | null,
): Promise<string> {
  let base = ensureUsernameFormat(preferredSeed, email);
  if (!USERNAME_RE.test(base)) {
    base = ensureUsernameFormat("filmfan", null);
  }

  if (!(await isUsernameTakenByOther(supabase, base, userId))) {
    return base;
  }

  for (let i = 2; i < 10_000; i += 1) {
    const suffix = `_${i}`;
    const headLen = Math.max(3, 24 - suffix.length);
    const head = base.slice(0, headLen);
    const candidate = `${head}${suffix}`;
    if (USERNAME_RE.test(candidate) && !(await isUsernameTakenByOther(supabase, candidate, userId))) {
      return candidate;
    }
  }

  const tail = `${Date.now()}`.slice(-6);
  const head = base.slice(0, Math.max(3, 24 - 1 - tail.length));
  const fallback = `${head}_${tail}`.slice(0, 24);
  if (USERNAME_RE.test(fallback) && !(await isUsernameTakenByOther(supabase, fallback, userId))) {
    return fallback;
  }
  return `user_${tail}`.slice(0, 24);
}

/**
 * Ensures OAuth / provider sign-ups get display_name, avatar_url, and a unique username.
 * Safe to call on every login; no-ops when nothing is missing.
 */
export async function syncProfileFromAuthUser(
  supabase: SupabaseClient,
  user: User,
): Promise<void> {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const email = user.email ?? null;
  const displayName =
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata.name === "string" && metadata.name.trim()) ||
    (email ? email.split("@")[0] : "") ||
    "Film fan";
  const avatarUrl =
    typeof metadata.avatar_url === "string"
      ? metadata.avatar_url
      : typeof metadata.picture === "string"
        ? metadata.picture
        : null;
  const preferredUsername =
    (typeof metadata.preferred_username === "string" &&
      metadata.preferred_username.trim()) ||
    (typeof metadata.user_name === "string" && metadata.user_name.trim()) ||
    displayName ||
    email ||
    "";

  const { data: profile, error: readErr } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (readErr) {
    console.error("[profile] syncProfileFromAuthUser read:", readErr.message);
    return;
  }

  const payload: Record<string, string> = {};

  if (!profile?.display_name?.trim() && displayName) {
    payload.display_name = displayName;
  }

  if (!profile?.avatar_url?.trim() && avatarUrl) {
    payload.avatar_url = avatarUrl;
  }

  if (!profile?.username?.trim()) {
    payload.username = await pickAvailableUsername(
      supabase,
      user.id,
      preferredUsername,
      email,
    );
  }

  if (Object.keys(payload).length === 0) return;

  const { error: updateErr } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", user.id);

  if (updateErr) {
    console.error("[profile] syncProfileFromAuthUser update:", updateErr.message, updateErr.code);
    if (updateErr.code === "23505" && payload.username) {
      const retryUsername = await pickAvailableUsername(
        supabase,
        user.id,
        `${payload.username}_x`,
        email,
      );
      const { error: retryErr } = await supabase
        .from("profiles")
        .update({
          ...payload,
          username: retryUsername,
        })
        .eq("id", user.id);
      if (retryErr) {
        console.error("[profile] syncProfileFromAuthUser retry:", retryErr.message);
      }
    }
  }
}
