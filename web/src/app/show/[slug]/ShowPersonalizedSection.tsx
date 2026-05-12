"use client";

import { ShowActions } from "./ShowActions";
import { SeasonRater } from "./SeasonRater";
import { MemberDiaryHighlightCard } from "@/components/social/MemberDiaryHighlightCard";
import { getShowUserState } from "@/app/show/actions";
import { posterUrl } from "@/lib/tmdb/constants";
import TmdbImage from "@/components/ui/TmdbImage";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type UserState = Awaited<ReturnType<typeof getShowUserState>>;

type Season = {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
  overview: string | null | undefined;
};

type Props = {
  tmdbId: number;
  slug: string;
  similarHref: string;
  trailerUrl: string | null;
  shareUrl: string;
  episodeRunTime: number | null;
  showName: string;
  seasons: Season[];
};

export function ShowPersonalizedSection({
  tmdbId,
  slug,
  similarHref,
  trailerUrl,
  shareUrl,
  episodeRunTime,
  showName,
  seasons,
}: Props) {
  const searchParams = useSearchParams();
  const reviewedBy = searchParams.get("reviewedBy");
  const libraryMovieId = searchParams.get("libraryMovieId");

  const [state, setState] = useState<UserState | null>(null);

  const relevantSeasonIds = seasons.filter((s) => s.season_number > 0).map((s) => s.id);

  useEffect(() => {
    getShowUserState(tmdbId, relevantSeasonIds, reviewedBy, libraryMovieId)
      .then(setState)
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmdbId, reviewedBy, libraryMovieId]);

  const loginRedirectPath = (() => {
    const sp = new URLSearchParams();
    if (reviewedBy) sp.set("reviewedBy", reviewedBy);
    if (libraryMovieId) sp.set("libraryMovieId", libraryMovieId);
    const qs = sp.toString();
    return `/show/${slug}${qs ? `?${qs}` : ""}`;
  })();

  return (
    <>
      {/* User rating */}
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
        <ShowActions
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
            to log, rate, and save this show.
          </p>
        ) : null}
      </div>

      {/* Seasons with per-season ratings */}
      {seasons.length > 0 ? (
        <section className="mt-12">
          <h2 className="mb-5 text-lg font-semibold text-white">Seasons ({seasons.length})</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {seasons.map((season) => {
              const seasonPoster = posterUrl(season.poster_path, "w342");
              const airYear = season.air_date?.slice(0, 4);
              const seasonEntry = state?.seasonRatings[season.id] ?? null;
              return (
                <div
                  key={season.id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-zinc-900/50 p-4"
                >
                  <div className="flex gap-3 sm:gap-4">
                    <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                      {seasonPoster ? (
                        <TmdbImage src={seasonPoster} alt={season.name} fill className="object-cover" sizes="56px" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white">{season.name}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {season.episode_count} episodes{airYear ? ` · ${airYear}` : ""}
                      </p>
                      {season.overview && (
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                          {season.overview}
                        </p>
                      )}
                    </div>
                  </div>
                  <SeasonRater
                    seasonTmdbId={season.id}
                    showTmdbId={tmdbId}
                    showName={showName}
                    seasonName={season.name}
                    posterPath={season.poster_path}
                    airDate={season.air_date}
                    episodeRunTime={episodeRunTime}
                    isLoggedIn={state?.isLoggedIn ?? false}
                    existing={seasonEntry}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}
