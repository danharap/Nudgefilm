import { signUpWithEmail } from "@/app/actions/auth";
import { GoogleOAuthSection } from "@/components/auth/GoogleOAuthSection";
import Link from "next/link";

type Props = {
  searchParams: Promise<{
    error?: string;
    message?: string;
    displayName?: string;
    username?: string;
    email?: string;
  }>;
};

/** Friendlier copy for Supabase auth errors users hit during QA / multi-account signup */
function formatSignupError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("rate limit") && lower.includes("email")) {
    return (
      "Too many confirmation emails were sent recently from this app (Supabase email rate limit). " +
      "Wait about an hour and try again, or in Supabase: Authentication → Emails / SMTP use a custom mail provider for higher limits."
    );
  }
  if (lower.includes("rate limit")) {
    return (
      "Too many auth attempts or emails right now. Please wait a little while and try again."
    );
  }
  return raw;
}

export default async function SignupPage({ searchParams }: Props) {
  const q = await searchParams;
  const err = q.error ? formatSignupError(decodeURIComponent(q.error)) : null;
  const prefilledDisplayName = q.displayName ? decodeURIComponent(q.displayName) : "";
  const prefilledUsername = q.username ? decodeURIComponent(q.username) : "";
  const prefilledEmail = q.email ? decodeURIComponent(q.email) : "";
  const redirect = "/auth/post-login";

  return (
    <div className="mx-auto max-w-sm px-4 py-20 sm:px-6">
      <h1 className="text-2xl font-semibold text-white">Sign up</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="text-indigo-300 hover:text-indigo-200">
          Log in
        </Link>
      </p>
      {q.message === "check_email" ? (
        <p className="mt-4 rounded-lg border border-indigo-400/25 bg-indigo-400/10 px-3 py-2 text-sm text-indigo-200">
          We sent a confirmation link to your email. Open it to finish sign-up, then log in here. If
          nothing arrives in a few minutes, check spam or promotions — the sender is your auth
          provider (e.g. Supabase), not Gmail specifically.
        </p>
      ) : null}
      {err ? (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {err}
        </p>
      ) : null}
      <GoogleOAuthSection redirect={redirect} authErrorPath="/signup">
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          <span className="text-zinc-400">Google:</span> No separate “confirm email” message from this
          app — Google already verified you. Finish in the browser window that opens. Your Google
          address can be Gmail, iCloud, or anything; Apple Mail is fine.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          We import your name and photo from Google. You can edit your profile anytime.
        </p>
      </GoogleOAuthSection>
      <div className="mt-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>
      <form action={signUpWithEmail} className="mt-8 space-y-4">
        <div className="space-y-2">
          <label htmlFor="displayName" className="text-sm text-zinc-400">
            Display name
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            required
            autoComplete="name"
            placeholder="Your name (e.g. Jane Doe)"
            defaultValue={prefilledDisplayName}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-400/25"
          />
          <p className="text-xs text-zinc-600">Shown on your profile.</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="username" className="text-sm text-zinc-400">
            Username
          </label>
          <div className="flex items-stretch">
            <span className="flex items-center rounded-l-xl border border-r-0 border-white/10 bg-black/40 px-3 text-xs text-zinc-500">
              @
            </span>
            <input
              id="username"
              name="username"
              type="text"
              required
              minLength={3}
              maxLength={24}
              pattern="[a-zA-Z0-9_]{3,24}"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              placeholder="janedoe"
              defaultValue={prefilledUsername}
              className="w-full rounded-r-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-400/25"
            />
          </div>
          <p className="text-xs text-zinc-600">
            3–24 characters · letters, numbers, underscores. Friends use this to find you.
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm text-zinc-400">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={prefilledEmail}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-400/25"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm text-zinc-400">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-400/25"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white hover:bg-indigo-300"
        >
          Create account
        </button>
      </form>
    </div>
  );
}
