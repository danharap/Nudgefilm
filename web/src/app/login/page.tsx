import { signInWithEmail } from "@/app/actions/auth";
import { GoogleOAuthSection } from "@/components/auth/GoogleOAuthSection";
import Link from "next/link";

type Props = {
  searchParams: Promise<{
    error?: string;
    redirect?: string;
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const q = await searchParams;
  const err = q.error ? decodeURIComponent(q.error) : null;
  const redirect =
    q.redirect && q.redirect.startsWith("/") ? q.redirect : "/auth/post-login";

  return (
    <div className="mx-auto max-w-sm px-4 py-20 sm:px-6">
      <h1 className="text-2xl font-semibold text-white">Log in</h1>
      <p className="mt-2 text-sm text-zinc-500">
        New here?{" "}
        <Link href="/signup" className="text-indigo-300 hover:text-indigo-200">
          Create an account
        </Link>
      </p>
      {q.message === "email_verified" ? (
        <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          Your email is verified. Sign in with the password you chose to continue.
        </p>
      ) : null}
      {err ? (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {err}
        </p>
      ) : null}
      <GoogleOAuthSection redirect={redirect} authErrorPath="/login">
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          Using Google? You won&apos;t get a confirmation email from us — sign-in completes after you
          approve Google. That works with any email on your Google account (Gmail, iCloud, etc.).
        </p>
      </GoogleOAuthSection>
      <div className="mt-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>
      <form action={signInWithEmail} className="mt-8 space-y-4">
        <input type="hidden" name="redirect" value={redirect} />
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
            autoComplete="current-password"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-400/25"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white hover:bg-indigo-300"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
