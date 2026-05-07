import { resolveAppOriginFromHeaders } from "@/lib/site-url";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

function loginWithMessage(origin: string, message: string) {
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(message)}`,
  );
}

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

async function pickAvailableUsername(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  preferredSeed: string,
  email: string | null,
): Promise<string> {
  const base = ensureUsernameFormat(preferredSeed, email);

  const { data: rows } = await supabase
    .from("profiles")
    .select("id, username")
    .ilike("username", `${base}%`)
    .neq("id", userId)
    .limit(200);

  const taken = new Set(
    (rows ?? [])
      .map((r: { username: string | null }) =>
        String(r.username ?? "").toLowerCase(),
      )
      .filter((u: string) => u.length > 0),
  );

  if (!taken.has(base)) return base;

  for (let i = 2; i < 1000; i += 1) {
    const suffix = `_${i}`;
    const head = base.slice(0, Math.max(3, 24 - suffix.length));
    const candidate = `${head}${suffix}`;
    if (USERNAME_RE.test(candidate) && !taken.has(candidate)) {
      return candidate;
    }
  }

  return `${base.slice(0, 18)}_${Date.now().toString().slice(-5)}`;
}

async function hydrateProfileFromOAuth(
  supabase: ReturnType<typeof createServerClient>,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const email = user.email ?? null;
  const displayName =
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata.name === "string" && metadata.name.trim()) ||
    (email ? email.split("@")[0] : "Film fan");
  const avatarUrl =
    typeof metadata.avatar_url === "string"
      ? metadata.avatar_url
      : typeof metadata.picture === "string"
        ? metadata.picture
        : null;
  const preferredUsername =
    (typeof metadata.preferred_username === "string" &&
      metadata.preferred_username) ||
    (typeof metadata.user_name === "string" && metadata.user_name) ||
    displayName ||
    email;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const payload: Record<string, string> = {};

  if (!profile?.display_name && displayName) {
    payload.display_name = displayName;
  }

  if (!profile?.avatar_url && avatarUrl) {
    payload.avatar_url = avatarUrl;
  }

  if (!profile?.username) {
    payload.username = await pickAvailableUsername(
      supabase,
      user.id,
      preferredUsername,
      email,
    );
  }

  if (Object.keys(payload).length === 0) return;

  await supabase.from("profiles").upsert({ id: user.id, ...payload });
}

export async function GET(request: Request) {
  const origin = resolveAppOriginFromHeaders(request.headers);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const postVerifyLogin = searchParams.get("post_verify") === "login";
  const rawNext = searchParams.get("next") ?? "/";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const oauthMessage =
    searchParams.get("error_description")?.trim() ||
    searchParams.get("error")?.trim();

  if (!code) {
    if (oauthMessage) {
      return loginWithMessage(origin, oauthMessage);
    }
    return loginWithMessage(
      origin,
      "We couldn’t finish signing you in from that link (no confirmation code). Open the email link on the same device and browser where you signed up, or request a new confirmation email from the sign-up page.",
    );
  }

  const cookieStore = await cookies();
  /** After signup email confirm we verify the token then sign out so the user logs in deliberately. */
  const redirectUrl = postVerifyLogin
    ? `${origin}/login?message=email_verified`
    : `${origin}${next}`;
  const response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet, headersMaybe) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          const headers = headersMaybe as Record<string, string> | undefined;
          if (headers) {
            Object.entries(headers).forEach(([key, value]) =>
              response.headers.set(key, value),
            );
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const msg = error.message.toLowerCase();
    const verifierHint =
      msg.includes("code verifier") ||
      msg.includes("pkce") ||
      msg.includes("non-empty") ||
      msg.includes("bad_oauth_state")
        ? " Try opening the confirmation link in the same browser where you created your account."
        : "";
    return loginWithMessage(origin, `${error.message}${verifierHint}`);
  }

  if (postVerifyLogin) {
    await supabase.auth.signOut();
  } else {
    await hydrateProfileFromOAuth(supabase);
  }

  return response;
}
