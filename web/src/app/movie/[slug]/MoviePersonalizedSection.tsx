"use client";

import { MovieActions } from "./MovieActions";
import { MemberDiaryHighlightCard } from "@/components/social/MemberDiaryHighlightCard";
import { Avatar } from "@/components/ui/Avatar";
import { getMovieUserState } from "@/app/movie/actions";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type UserState = Awaited<ReturnType<typeof getMovieUserState>>;

type Props = {
  tmdbId: number;
  slug: string;
  similarHref: string;
  trailerUrl: string | null;
  shareUrl: string;
};

export function MoviePersonalizedSection({ tmdbId, slug, similarHref, trailerUrl, shareUrl }: Props) {
  const searchParams = useSearchParams();
  const reviewedBy = searchParams.get("reviewedBy");
  const libraryMovieId = searchParams.get("libraryMovieId");

  const [state, setState] = useState<UserState | null>(null);

  useEffect(() => {
    getMovieUserState(tmdbId, reviewedBy, libraryMovieId).then(setState).catch(console.error);
  }, [tmdbId, reviewedBy, libraryMovieId]);

  const loginRedirectPath = (() => {
    const sp = new URLSearchParams();
    if (reviewedBy) sp.set("reviewedBy", reviewedBy);
    if (libraryMovieId) sp.set("libraryMovieId", libraryMovieId);
    const qs = sp.toString();
    return `/movie/${slug}${qs ? `?${qs}` : ""}`;
  })();

  return (
    <>
      {/* User rating shown below title metadata */}
      {state?.existing?.user_rating ? (
        <p className="mt-1 text-sm text-indigo-200/80">
          Your rating: <span className="font-semibold">{state.existing.user_rating}/10</span>
        </p>
      ) : null}

      {/* Social diary highlight */}
      {state?.memberDiaryHighlight ? (
        <MemberDiaryHighlightCard highlight={state.memberDiaryHighlight} />
      ) : null}

      {/* Action panel */}
      <div className="lg:sticky lg:top-20">
        <MovieActions
          tmdbId={tmdbId}
          loginRedirectPath={loginRedirectPath}
          isLoggedIn={state?.isLoggedIn ?? false}
          existing={state?.existing ?? null}
          inWatchlist={state?.inWatchlist ?? false}
          similarHref={similarHref}
          trailerUrl={trailerUrl}
          shareUrl={shareUrl}
        />
        {state !== null && !state.isLoggedIn ? (
          <p className="mt-3 text-center text-xs text-zinc-500 lg:text-left">
            <Link href={`/login?redirect=${encodeURIComponent(loginRedirectPath)}`} className="underline-offset-2 hover:underline">
              Sign in
            </Link>{" "}
            to log, rate, and save this film.
          </p>
        ) : null}
      </div>

      {/* User notes */}
      {state?.existing?.notes ? (
        <div className="mt-6 rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-3">
          <p className="text-xs text-zinc-500">Your notes</p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-300">{state.existing.notes}</p>
        </div>
      ) : null}

      {/* Social section: friend ratings + public reviews */}
      {(state?.friendRatings.length ?? 0) > 0 || (state?.recentReviews.length ?? 0) > 0 ? (
        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          {(state?.friendRatings ?? []).length > 0 ? (
            <div className="rounded-2xl border border-white/10 bg-zinc-900/30 p-4">
              <p className="mb-3 text-xs font-medium text-zinc-400">Friends who watched this</p>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {(state?.friendRatings ?? []).map((f) => (
                  <Link
                    key={f.name}
                    href={f.username ? `/user/${f.username}` : "#"}
                    className="flex min-h-11 items-center gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2 transition hover:border-white/10"
                  >
                    <Avatar url={f.avatar_url} name={f.name} size={28} />
                    <div>
                      <p className="text-xs font-medium text-white">{f.name}</p>
                      <p className="text-xs text-indigo-300/80">{f.rating}/10</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {(state?.recentReviews ?? []).length > 0 ? (
            <div className="rounded-2xl border border-white/10 bg-zinc-900/30 p-4">
              <p className="mb-3 text-xs font-medium text-zinc-400">Recent reviews</p>
              <div className="space-y-3">
                {(state?.recentReviews ?? []).map((r, i) => (
                  <div key={`${r.username ?? r.name}-${i}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <Avatar url={r.avatar_url} name={r.name} size={22} />
                      <p className="text-xs text-zinc-200">{r.name}</p>
                      {r.rating != null ? <span className="text-xs text-indigo-300">{r.rating}/10</span> : null}
                    </div>
                    <p className="line-clamp-3 text-sm text-zinc-300">{r.notes}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
