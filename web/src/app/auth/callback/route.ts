import { syncProfileFromAuthUser } from "@/features/profile/syncProfileFromAuthUser";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * OAuth return URL must use the same origin the browser used for /auth/callback
 * (see Supabase Next.js guide). Prefer request.url over proxy headers to avoid mismatches.
 */
function loginWithMessage(appOrigin: string, message: string) {
  return NextResponse.redirect(
    `${appOrigin}/login?error=${encodeURIComponent(message)}`,
  );
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const appOrigin = requestUrl.origin;
  const { searchParams } = requestUrl;
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
      return loginWithMessage(appOrigin, oauthMessage);
    }
    return loginWithMessage(
      appOrigin,
      "We couldn’t finish signing you in from that link (no confirmation code). Open the email link on the same device and browser where you signed up, or request a new confirmation email from the sign-up page.",
    );
  }

  const cookieStore = await cookies();
  /** After signup email confirm we verify the token then sign out so the user logs in deliberately. */
  const redirectUrl = postVerifyLogin
    ? `${appOrigin}/login?message=email_verified`
    : `${appOrigin}${next}`;
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
    return loginWithMessage(appOrigin, `${error.message}${verifierHint}`);
  }

  if (postVerifyLogin) {
    await supabase.auth.signOut();
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await syncProfileFromAuthUser(supabase, user);
    }
  }

  return response;
}
