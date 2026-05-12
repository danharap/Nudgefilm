"use client";

import { BrowseMovieCard, type BrowseMovie } from "./BrowseMovieCard";
import { BrowseSearch } from "./BrowseSearch";
import { BrowseDiscoveryHero } from "./BrowseDiscoveryHero";
import { BrowseTypeFilter } from "./BrowseTypeFilter";
import { browseMediaPath } from "@/lib/media-slug";
import { posterUrl } from "@/lib/tmdb/constants";
import TmdbImage from "@/components/ui/TmdbImage";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

type ContentType = "all" | "movies" | "tv";

export type AllBrowseData = {
  moviesPopular: BrowseMovie[];
  moviesTrending: BrowseMovie[];
  moviesSpotlight: BrowseMovie[];
  tvPopular: BrowseMovie[];
  tvTrending: BrowseMovie[];
  tvSpotlight: BrowseMovie[];
};

function MovieGrid({ movies }: { movies: BrowseMovie[] }) {
  if (movies.length === 0) {
    return <p className="py-16 text-center text-sm text-tertiary">No results found.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {movies.map((m) => (
        <BrowseMovieCard key={`${m.mediaType ?? "movie"}-${m.id}`} movie={m} />
      ))}
    </div>
  );
}

export function BrowseContentView({ data }: { data: AllBrowseData }) {
  const searchParams = useSearchParams();
  const rawType = searchParams.get("type");
  const contentType: ContentType =
    rawType === "movies" ? "movies" : rawType === "tv" ? "tv" : "all";

  const spotlightColors = {
    red: { dot: "bg-red-500", ping: "bg-red-400", badge: "bg-red-500/15 text-red-400" },
    violet: { dot: "bg-violet-500", ping: "bg-violet-400", badge: "bg-violet-500/15 text-violet-400" },
    indigo: { dot: "bg-indigo-500", ping: "bg-indigo-400", badge: "bg-indigo-500/15 text-indigo-400" },
  };

  let spotlight: BrowseMovie[];
  let trending: BrowseMovie[];
  let popular: BrowseMovie[];
  let spotlightLabel: string;
  let spotlightBadge: string;
  let spotlightColor: keyof typeof spotlightColors;
  let trendingLabel: string;
  let popularLabel: string;
  let searchType: "all" | "movies" | "tv";

  if (contentType === "movies") {
    spotlight = data.moviesSpotlight;
    trending = data.moviesTrending;
    popular = data.moviesPopular;
    spotlightLabel = "Now in Theaters";
    spotlightBadge = "In cinemas";
    spotlightColor = "red";
    trendingLabel = "Trending Films This Week";
    popularLabel = "Popular Films";
    searchType = "movies";
  } else if (contentType === "tv") {
    spotlight = data.tvSpotlight;
    trending = data.tvTrending;
    popular = data.tvPopular;
    spotlightLabel = "Now Airing";
    spotlightBadge = "On TV";
    spotlightColor = "violet";
    trendingLabel = "Trending TV This Week";
    popularLabel = "Popular TV Shows";
    searchType = "tv";
  } else {
    // "all" — interleaved movies + tv
    const mergedPopular: BrowseMovie[] = [];
    const len = Math.max(data.moviesPopular.length, data.tvPopular.length);
    for (let i = 0; i < len; i++) {
      if (data.moviesPopular[i]) mergedPopular.push(data.moviesPopular[i]);
      if (data.tvPopular[i]) mergedPopular.push(data.tvPopular[i]);
    }

    const trendingMixed: BrowseMovie[] = [
      ...data.moviesTrending.slice(0, 5),
      ...data.tvTrending.slice(0, 5),
    ].sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0));

    spotlight = [...data.moviesSpotlight.slice(0, 10), ...data.tvSpotlight.slice(0, 10)];
    trending = trendingMixed;
    popular = mergedPopular.slice(0, 20);
    spotlightLabel = "New This Week";
    spotlightBadge = "Movies & TV";
    spotlightColor = "indigo";
    trendingLabel = "Trending This Week";
    popularLabel = "Popular Right Now";
    searchType = "all";
  }

  const colors = spotlightColors[spotlightColor];

  return (
    <>
      <BrowseDiscoveryHero />

      <div className="mb-10">
        <BrowseSearch
          toolbarStart={
            <Suspense fallback={<div className="h-10 w-[280px] max-w-full animate-pulse rounded-xl bg-[var(--surface-2)]" />}>
              <BrowseTypeFilter current={contentType} />
            </Suspense>
          }
          type={searchType}
        />
      </div>

      {/* Spotlight rail */}
      {spotlight.length > 0 && (
        <section className="mb-14">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="relative flex size-2">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${colors.ping} opacity-75`} />
                <span className={`relative inline-flex size-2 rounded-full ${colors.dot}`} />
              </span>
              <h2 className="text-lg font-semibold text-primary">{spotlightLabel}</h2>
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.badge}`}>
              {spotlightBadge}
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
            {spotlight.slice(0, 20).map((item) => {
              const poster = posterUrl(item.poster_path, "w342");
              const year = item.release_date?.slice(0, 4);
              const href = browseMediaPath(item.title, item.id, item.mediaType);
              return (
                <Link key={`${item.mediaType}-${item.id}`} href={href} prefetch={false} className="group relative w-32 shrink-0 sm:w-36">
                  <div className="premium-card relative aspect-[2/3] overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--surface-1)] transition duration-300 group-hover:border-indigo-400/35">
                    {poster ? (
                      <TmdbImage
                        src={poster}
                        alt={item.title}
                        fill
                        className="object-cover transition duration-300 group-hover:scale-[1.04]"
                        sizes="144px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-2 text-center text-[11px] text-zinc-500">
                        {item.title}
                      </div>
                    )}
                    {item.vote_average > 0 && (
                      <div className="absolute right-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                        {item.vote_average.toFixed(1)}
                      </div>
                    )}
                    {item.mediaType === "tv" && (
                      <div className="absolute left-1.5 bottom-1.5 rounded-md bg-violet-600/80 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                        TV
                      </div>
                    )}
                  </div>
                  <p className="mt-2 truncate text-xs font-medium text-secondary group-hover:text-primary">
                    {item.title}
                  </p>
                  {year && <p className="mt-0.5 text-[11px] text-tertiary">{year}</p>}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mb-12">
        <h2 className="mb-4 text-lg font-semibold text-primary">{trendingLabel}</h2>
        <MovieGrid movies={trending.slice(0, 10)} />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-primary">{popularLabel}</h2>
        <MovieGrid movies={popular.slice(0, 20)} />
      </section>
    </>
  );
}
