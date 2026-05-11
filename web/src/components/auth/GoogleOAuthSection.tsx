"use client";

import { createClient } from "@/lib/supabase/client";
import { isGoogleOAuthLikelyBlockedUserAgent } from "@/lib/oauth-user-agent";
import type { ReactNode } from "react";
import { useState } from "react";

const buttonClassName =
  "inline-flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10 disabled:opacity-60";

type Props = {
  redirect: string;
  /** Where to send OAuth start errors (e.g. Supabase network errors). */
  authErrorPath?: "/login" | "/signup";
  children?: ReactNode;
};

function normalizeRedirect(path: string): string {
  return path.startsWith("/") && !path.startsWith("//") ? path : "/auth/post-login";
}

export function GoogleOAuthSection({ redirect, authErrorPath = "/login", children }: Props) {
  const [busy, setBusy] = useState(false);
  const [inAppWall, setInAppWall] = useState(false);

  async function startGoogleSignIn(skipUaCheck = false) {
    if (
      !skipUaCheck &&
      typeof navigator !== "undefined" &&
      isGoogleOAuthLikelyBlockedUserAgent(navigator.userAgent)
    ) {
      setInAppWall(true);
      return;
    }

    setInAppWall(false);
    setBusy(true);
    try {
      const next = normalizeRedirect(redirect);
      const origin = window.location.origin;
      /** Must be listed under Supabase → Authentication → URL Configuration → Redirect URLs. */
      const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        window.location.href = `${authErrorPath}?error=${encodeURIComponent(error.message)}`;
        return;
      }

      if (data.url) {
        window.location.assign(data.url);
        return;
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 w-full">
      {inAppWall ? (
        <div className="mb-4 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
          <p className="font-medium text-amber-50">This browser can’t complete Google sign-in</p>
          <p className="mt-2 leading-relaxed text-amber-100/90">
            Google only allows sign-in from a full system browser (Chrome, Safari, or Edge). If you
            opened this link inside Instagram, Facebook, TikTok, Messages, or another app, use the{" "}
            <strong className="text-amber-50">⋯</strong> or <strong className="text-amber-50">⋮</strong>{" "}
            menu and choose <strong className="text-amber-50">Open in browser</strong> /{" "}
            <strong className="text-amber-50">Open in Chrome</strong>, then try again.
          </p>
          <p className="mt-2 text-xs text-amber-200/80">
            If you are in the Cursor or VS Code embedded preview, open the same URL in a normal
            desktop browser instead.
          </p>
          <button
            type="button"
            className="mt-3 text-xs font-semibold text-indigo-200 underline hover:text-indigo-100"
            onClick={() => void startGoogleSignIn(true)}
          >
            I’m already in Chrome, Safari, or Edge — try Google again
          </button>
        </div>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={() => void startGoogleSignIn()}
        className={buttonClassName}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          aria-hidden
        >
          <path
            fill="#EA4335"
            d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.2-1.9 2.9l3 2.4c1.7-1.6 2.7-4 2.7-6.9 0-.7-.1-1.3-.2-1.9H12z"
          />
          <path
            fill="#34A853"
            d="M12 22c2.4 0 4.5-.8 6-2.2l-3-2.4c-.8.6-1.8.9-3 .9-2.3 0-4.2-1.5-4.9-3.6l-3.1 2.4C5.4 20 8.5 22 12 22z"
          />
          <path
            fill="#4A90E2"
            d="M7.1 14.7c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9l-3.1-2.4C3.4 9.8 3 11.1 3 12.8s.4 3 1 4.3l3.1-2.4z"
          />
          <path
            fill="#FBBC05"
            d="M12 7.3c1.3 0 2.4.4 3.3 1.3l2.5-2.5C16.5 4.8 14.4 4 12 4 8.5 4 5.4 6 4 9l3.1 2.4c.7-2.1 2.6-3.6 4.9-3.6z"
          />
        </svg>
        {busy ? "Redirecting…" : "Continue with Google"}
      </button>

      <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
        Google requires a normal browser window. If you see “does not comply with Google’s secure
        browser policy,” open this site in Chrome, Safari, or Edge—not an in-app browser.
      </p>

      {children}
    </div>
  );
}
