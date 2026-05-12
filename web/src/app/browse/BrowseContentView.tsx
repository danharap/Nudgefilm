"use client";

import { BrowseMovieCard, type BrowseMovie } from "./BrowseMovieCard";
import { useBrowseLibrary } from "./BrowseLibraryContext";
import { BrowseSearch } from "./BrowseSearch";
import { BrowseDiscoveryHero } from "./BrowseDiscoveryHero";
import { BrowseTypeFilter, type ContentType } from "./BrowseTypeFilter";
import { browseMediaPath } from "@/lib/media-slug";
import { posterUrl } from "@/lib/tmdb/constants";
import TmdbImage from "@/components/ui/TmdbImage";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";


// Genre IDs considered mature/18+ for client-side filtering.
// TMDB's `adult` flag only covers explicit content; R-rated films like Horror
// are never flagged, so we filter by genre as a reliable proxy.
const MATURE_GENRE_IDS = new Set([27]); // 27 = Horror

function filterForMaturePreference(
  movies: BrowseMovie[],
  showMatureContent: boolean,
  loaded: boolean,
): BrowseMovie[] {
  if (!loaded || showMatureContent) return movies;
  return movies.filter(
    (m) =>
      !m.adult &&
      !(m.genre_ids ?? []).some((id) => MATURE_GENRE_IDS.has(id)),
  );
}

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
    rawType === "movies"
      ? "movies"
      : rawType === "tv"
        ? "tv"
        : rawType === "people"
          ? "people"
          : "all";

  const { isLoggedIn, is18Plus, showMatureContent, loaded, toggleMatureContent } = useBrowseLibrary();

  const filteredData: AllBrowseData = {
    moviesPopular: filterForMaturePreference(data.moviesPopular, showMatureContent, loaded),
    moviesTrending: filterForMaturePreference(data.moviesTrending, showMatureContent, loaded),
    moviesSpotlight: filterForMaturePreference(data.moviesSpotlight, showMatureContent, loaded),
    tvPopular: filterForMaturePreference(data.tvPopular, showMatureContent, loaded),
    tvTrending: filterForMaturePreference(data.tvTrending, showMatureContent, loaded),
    tvSpotlight: filterForMaturePreference(data.tvSpotlight, showMatureContent, loaded),
  };

  const spotlightColors = {
    red: { dot: "bg-red-500", ping: "bg-red-400", badge: "bg-red-500/15 text-red-400" },
    violet: { dot: "bg-violet-500", ping: "bg-violet-400", badge: "bg-violet-500/15 text-violet-400" },
    indigo: { dot: "bg-indigo-500", ping: "bg-indigo-400", badge: "bg-indigo-500/15 text-indigo-400" },
  };

  let spotlight: BrowseMovie[] = [];
  let trending: BrowseMovie[] = [];
  let popular: BrowseMovie[] = [];
  let spotlightLabel = "";
  let spotlightBadge = "";
  let spotlightColor: keyof typeof spotlightColors = "indigo";
  let trendingLabel = "";
  let popularLabel = "";

  if (contentType === "movies") {
    spotlight = filteredData.moviesSpotlight;
    trending = filteredData.moviesTrending;
    popular = filteredData.moviesPopular;
    spotlightLabel = "Now in Theaters";
    spotlightBadge = "In cinemas";
    spotlightColor = "red";
    trendingLabel = "Trending Films This Week";
    popularLabel = "Popular Films";
  } else if (contentType === "tv") {
    spotlight = filteredData.tvSpotlight;
    trending = filteredData.tvTrending;
    popular = filteredData.tvPopular;
    spotlightLabel = "Now Airing";
    spotlightBadge = "On TV";
    spotlightColor = "violet";
    trendingLabel = "Trending TV This Week";
    popularLabel = "Popular TV Shows";
  } else if (contentType !== "people") {
    // "all" — interleaved movies + tv
    const mergedPopular: BrowseMovie[] = [];
    const len = Math.max(filteredData.moviesPopular.length, filteredData.tvPopular.length);
    for (let i = 0; i < len; i++) {
      if (filteredData.moviesPopular[i]) mergedPopular.push(filteredData.moviesPopular[i]);
      if (filteredData.tvPopular[i]) mergedPopular.push(filteredData.tvPopular[i]);
    }

    const trendingMixed: BrowseMovie[] = [
      ...filteredData.moviesTrending.slice(0, 5),
      ...filteredData.tvTrending.slice(0, 5),
    ].sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0));

    spotlight = [...filteredData.moviesSpotlight.slice(0, 10), ...filteredData.tvSpotlight.slice(0, 10)];
    trending = trendingMixed;
    popular = mergedPopular.slice(0, 20);
    spotlightLabel = "New This Week";
    spotlightBadge = "Movies & TV";
    spotlightColor = "indigo";
    trendingLabel = "Trending This Week";
    popularLabel = "Popular Right Now";
  }

  const colors = spotlightColors[spotlightColor];

  // 18+ toggle pill — only shown when user is logged in and 18+ verified
  const matureToggle =
    loaded && isLoggedIn && is18Plus ? (
      <button
        type="button"
        onClick={() => toggleMatureContent(!showMatureContent)}
        aria-pressed={showMatureContent}
        title={showMatureContent ? "Showing 18+ content — click to restrict" : "18+ content hidden — click to show"}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
          showMatureContent
            ? "border-rose-400/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"
            : "border-white/10 bg-white/5 text-zinc-500 hover:text-zinc-300"
        }`}
      >
        <span className={`inline-block size-1.5 rounded-full ${showMatureContent ? "bg-rose-400" : "bg-zinc-600"}`} />
        18+
      </button>
    ) : null;

  const toolbar = (
    <div className="flex shrink-0 items-center gap-2">
      <Suspense fallback={<div className="h-10 w-[340px] max-w-full animate-pulse rounded-xl bg-[var(--surface-2)]" />}>
        <BrowseTypeFilter current={contentType} />
      </Suspense>
      {matureToggle}
    </div>
  );

  return (
    <>
      <BrowseDiscoveryHero />

      <div className="mb-10">
        <BrowseSearch toolbarStart={toolbar} type={contentType} />
      </div>

      {/* People mode: search-only, no grid content */}
      {contentType === "people" && (
        <div className="py-8 text-center">
          <p className="text-sm text-tertiary">
            Search for an actor, director, or writer above to explore their filmography.
          </p>
        </div>
      )}

      {/* Spotlight rail */}
      {contentType !== "people" && spotlight.length > 0 && (
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

      {contentType !== "people" && (
        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold text-primary">{trendingLabel}</h2>
          <MovieGrid movies={trending.slice(0, 10)} />
        </section>
      )}

      {contentType !== "people" && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-primary">{popularLabel}</h2>
          <MovieGrid movies={popular.slice(0, 20)} />
        </section>
      )}
    </>
  );
}
