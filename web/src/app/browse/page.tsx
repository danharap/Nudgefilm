import { BrowseMovieCard, type BrowseMovie } from "./BrowseMovieCard";
import { BrowseSearch } from "./BrowseSearch";
import { BrowseTypeFilter } from "./BrowseTypeFilter";
import {
  getPopularMovies,
  getTrendingMovies,
  getNowPlayingMovies,
  getPopularTV,
  getTrendingTV,
  getNowAiringTV,
  type TVShowResult,
} from "@/lib/tmdb/client";
import { browseCanonicalTmdbId, posterUrl } from "@/lib/tmdb/constants";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

type ContentType = "all" | "movies" | "tv";

function normalizeTV(show: TVShowResult): BrowseMovie {
  return {
    id: show.id,
    title: show.name,
    release_date: show.first_air_date ?? "",
    poster_path: show.poster_path,
    vote_average: show.vote_average,
    vote_count: show.vote_count,
    overview: show.overview,
    genre_ids: show.genre_ids,
    mediaType: "tv",
  };
}

async function loadBrowseData(type: ContentType) {
  try {
    if (type === "movies") {
      const [popular, trending, nowPlaying] = await Promise.all([
        getPopularMovies("1"),
        getTrendingMovies("week"),
        getNowPlayingMovies("1"),
      ]);
      return {
        popular: (popular.results ?? []).map((m) => ({ ...m, mediaType: "movie" as const })),
        trending: (trending.results ?? []).map((m) => ({ ...m, mediaType: "movie" as const })),
        spotlight: (nowPlaying.results ?? []).map((m) => ({ ...m, mediaType: "movie" as const })),
        spotlightLabel: "Now in Theaters",
        spotlightBadge: "In cinemas",
        spotlightColor: "red" as const,
      };
    }

    if (type === "tv") {
      const [popular, trending, nowAiring] = await Promise.all([
        getPopularTV("1"),
        getTrendingTV("week"),
        getNowAiringTV("1"),
      ]);
      return {
        popular: (popular.results ?? []).map(normalizeTV),
        trending: (trending.results ?? []).map(normalizeTV),
        spotlight: (nowAiring.results ?? []).map(normalizeTV),
        spotlightLabel: "Now Airing",
        spotlightBadge: "On TV",
        spotlightColor: "violet" as const,
      };
    }

    // "all" — fetch everything in parallel
    const [popularMovies, trendingMovies, nowPlaying, popularTV, trendingTV, nowAiring] =
      await Promise.all([
        getPopularMovies("1"),
        getTrendingMovies("week"),
        getNowPlayingMovies("1"),
        getPopularTV("1"),
        getTrendingTV("week"),
        getNowAiringTV("1"),
      ]);

    const moviesWithType = (popularMovies.results ?? []).map((m) => ({ ...m, mediaType: "movie" as const }));
    const tvWithType = (popularTV.results ?? []).map(normalizeTV);

    const mergedPopular: BrowseMovie[] = [];
    const len = Math.max(moviesWithType.length, tvWithType.length);
    for (let i = 0; i < len; i++) {
      if (moviesWithType[i]) mergedPopular.push(moviesWithType[i]);
      if (tvWithType[i]) mergedPopular.push(tvWithType[i]);
    }

    const trendingMixed: BrowseMovie[] = [
      ...(trendingMovies.results ?? []).slice(0, 5).map((m) => ({ ...m, mediaType: "movie" as const })),
      ...(trendingTV.results ?? []).slice(0, 5).map(normalizeTV),
    ].sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0));

    return {
      popular: mergedPopular.slice(0, 20),
      trending: trendingMixed,
      spotlight: [
        ...(nowPlaying.results ?? []).slice(0, 10).map((m) => ({ ...m, mediaType: "movie" as const })),
        ...(nowAiring.results ?? []).slice(0, 10).map(normalizeTV),
      ],
      spotlightLabel: "New This Week",
      spotlightBadge: "Movies & TV",
      spotlightColor: "indigo" as const,
    };
  } catch (e) {
    console.error("[browse] failed to load TMDb data:", e);
    return {
      popular: [],
      trending: [],
      spotlight: [],
      spotlightLabel: "Now in Theaters",
      spotlightBadge: "In cinemas",
      spotlightColor: "red" as const,
    };
  }
}

async function loadUserLibrary() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { watchedIds: new Set<number>(), watchlistIds: new Set<number>(), isLoggedIn: false };

    const [{ data: watched }, { data: watchlist }] = await Promise.all([
      supabase.from("watched_movies").select("movies ( tmdb_id )").eq("user_id", user.id),
      supabase.from("watchlist").select("movies ( tmdb_id )").eq("user_id", user.id),
    ]);

    const watchedIds = new Set<number>(
      (watched ?? []).flatMap((r) => {
        const m = r.movies as { tmdb_id: number } | { tmdb_id: number }[] | null;
        if (!m) return [];
        const ids = Array.isArray(m) ? m.map((x) => x.tmdb_id) : [m.tmdb_id];
        return ids
          .map((dbId) => browseCanonicalTmdbId(dbId))
          .filter((id): id is number => id != null);
      }),
    );
    const watchlistIds = new Set<number>(
      (watchlist ?? []).flatMap((r) => {
        const m = r.movies as { tmdb_id: number } | { tmdb_id: number }[] | null;
        if (!m) return [];
        const ids = Array.isArray(m) ? m.map((x) => x.tmdb_id) : [m.tmdb_id];
        return ids
          .map((dbId) => browseCanonicalTmdbId(dbId))
          .filter((id): id is number => id != null);
      }),
    );
    return { watchedIds, watchlistIds, isLoggedIn: true };
  } catch (e) {
    console.error("[browse] failed to load user library:", e);
    return { watchedIds: new Set<number>(), watchlistIds: new Set<number>(), isLoggedIn: false };
  }
}

function MovieGrid({
  movies,
  watchedIds,
  watchlistIds,
  isLoggedIn,
}: {
  movies: BrowseMovie[];
  watchedIds: Set<number>;
  watchlistIds: Set<number>;
  isLoggedIn: boolean;
}) {
  if (movies.length === 0) {
    return <p className="py-16 text-center text-sm text-tertiary">No results found.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {movies.map((m) => (
        <BrowseMovieCard
          key={`${m.mediaType ?? "movie"}-${m.id}`}
          movie={m}
          isWatched={watchedIds.has(m.id)}
          isWatchlisted={watchlistIds.has(m.id)}
          isLoggedIn={isLoggedIn}
        />
      ))}
    </div>
  );
}

type PageProps = { searchParams: Promise<{ type?: string }> };

export default async function BrowsePage({ searchParams }: PageProps) {
  const { type: rawType } = await searchParams;
  const contentType: ContentType =
    rawType === "movies" ? "movies" : rawType === "tv" ? "tv" : "all";

  const [data, { watchedIds, watchlistIds, isLoggedIn }] = await Promise.all([
    loadBrowseData(contentType),
    loadUserLibrary(),
  ]);

  const spotlightColors = {
    red: { dot: "bg-red-500", ping: "bg-red-400", badge: "bg-red-500/15 text-red-400" },
    violet: { dot: "bg-violet-500", ping: "bg-violet-400", badge: "bg-violet-500/15 text-violet-400" },
    indigo: { dot: "bg-indigo-500", ping: "bg-indigo-400", badge: "bg-indigo-500/15 text-indigo-400" },
  };
  const colors = spotlightColors[data.spotlightColor];

  const trendingLabel =
    contentType === "tv" ? "Trending TV This Week" :
    contentType === "movies" ? "Trending Films This Week" :
    "Trending This Week";

  const popularLabel =
    contentType === "tv" ? "Popular TV Shows" :
    contentType === "movies" ? "Popular Films" :
    "Popular Right Now";

  const searchType = contentType === "all" ? "all" : contentType === "tv" ? "tv" : "movies";

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <header className="mb-8 space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-500/75">Discover</p>
        <h1 className="text-3xl font-semibold text-primary">Browse</h1>
        <p className="text-sm text-secondary">
          Search or explore what&apos;s trending right now.
        </p>
      </header>

      {/* Type filter + search */}
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Suspense>
          <BrowseTypeFilter current={contentType} />
        </Suspense>
        <div className="flex-1">
          <BrowseSearch isLoggedIn={isLoggedIn} type={searchType} />
        </div>
      </div>

      {/* Spotlight rail (Now in Theaters / Now Airing / New This Week) */}
      {data.spotlight.length > 0 && (
        <section className="mb-14">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="relative flex size-2">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${colors.ping} opacity-75`} />
                <span className={`relative inline-flex size-2 rounded-full ${colors.dot}`} />
              </span>
              <h2 className="text-lg font-semibold text-primary">{data.spotlightLabel}</h2>
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.badge}`}>
              {data.spotlightBadge}
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
            {data.spotlight.slice(0, 20).map((item) => {
              const poster = posterUrl(item.poster_path, "w342");
              const year = item.release_date?.slice(0, 4);
              const href = item.mediaType === "tv" ? `/show/${item.id}` : `/movie/${item.id}`;
              return (
                <Link key={`${item.mediaType}-${item.id}`} href={href} className="group relative w-32 shrink-0 sm:w-36">
                  <div className="premium-card relative aspect-[2/3] overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--surface-1)] transition duration-300 group-hover:border-indigo-400/35">
                    {poster ? (
                      <Image
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

      {/* Trending */}
      <section className="mb-12">
        <h2 className="mb-4 text-lg font-semibold text-primary">{trendingLabel}</h2>
        <MovieGrid
          movies={data.trending.slice(0, 10) as BrowseMovie[]}
          watchedIds={watchedIds}
          watchlistIds={watchlistIds}
          isLoggedIn={isLoggedIn}
        />
      </section>

      {/* Popular */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-primary">{popularLabel}</h2>
        <MovieGrid
          movies={data.popular.slice(0, 20) as BrowseMovie[]}
          watchedIds={watchedIds}
          watchlistIds={watchlistIds}
          isLoggedIn={isLoggedIn}
        />
      </section>
    </div>
  );
}
