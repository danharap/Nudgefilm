import { signInWithEmail, signInWithGoogle } from "@/app/actions/auth";
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
      <form action={signInWithGoogle} className="mt-8">
        <input type="hidden" name="redirect" value={redirect} />
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10"
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
          Continue with Google
        </button>
      </form>
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
