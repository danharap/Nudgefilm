import { BrowseLibraryProvider } from "./BrowseLibraryContext";
import { BrowseContentView, type AllBrowseData } from "./BrowseContentView";
import {
  getPopularMovies,
  getTrendingMovies,
  getNowPlayingMovies,
  getPopularTV,
  getTrendingTV,
  getNowAiringTV,
  type TVShowResult,
} from "@/lib/tmdb/client";
import type { BrowseMovie } from "./BrowseMovieCard";
import { Suspense } from "react";

// Fully static — content type filter runs client-side; TMDb data cached for 1 hour.
export const revalidate = 3600;

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

async function loadAllBrowseData(): Promise<AllBrowseData> {
  try {
    const [popularMovies, trendingMovies, nowPlaying, popularTV, trendingTV, nowAiring] =
      await Promise.all([
        getPopularMovies("1"),
        getTrendingMovies("week"),
        getNowPlayingMovies("1"),
        getPopularTV("1"),
        getTrendingTV("week"),
        getNowAiringTV("1"),
      ]);

    const toMovie = (m: { id: number; title: string; release_date?: string; poster_path: string | null; vote_average: number; vote_count: number; overview: string; genre_ids?: number[]; adult?: boolean }) => ({
      ...m,
      mediaType: "movie" as const,
      release_date: m.release_date ?? "",
      genre_ids: m.genre_ids ?? [],
      adult: m.adult ?? false,
    });

    return {
      moviesPopular: (popularMovies.results ?? []).map(toMovie),
      moviesTrending: (trendingMovies.results ?? []).map(toMovie),
      moviesSpotlight: (nowPlaying.results ?? []).map(toMovie),
      tvPopular: (popularTV.results ?? []).map(normalizeTV),
      tvTrending: (trendingTV.results ?? []).map(normalizeTV),
      tvSpotlight: (nowAiring.results ?? []).map(normalizeTV),
    };
  } catch (e) {
    console.error("[browse] failed to load TMDb data:", e);
    return { moviesPopular: [], moviesTrending: [], moviesSpotlight: [], tvPopular: [], tvTrending: [], tvSpotlight: [] };
  }
}

export default async function BrowsePage() {
  const data = await loadAllBrowseData();

  return (
    <BrowseLibraryProvider>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <header className="mb-8 space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-500/75">Discover</p>
          <h1 className="text-3xl font-semibold text-primary">Browse</h1>
          <p className="text-sm text-secondary">
            Explore what&apos;s trending, or get a curated pick.
          </p>
        </header>

        <Suspense fallback={null}>
          <BrowseContentView data={data} />
        </Suspense>
      </div>
    </BrowseLibraryProvider>
  );
}
