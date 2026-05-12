import { TMDB_API_BASE } from "./constants";

/** Prefer v4 read token (Bearer); fallback to v3 api_key query param. */
function getTmdbAuth():
  | { kind: "bearer"; token: string }
  | { kind: "query"; apiKey: string } {
  const token = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
  if (token) return { kind: "bearer", token };
  const key = process.env.TMDB_API_KEY?.trim();
  if (key) return { kind: "query", apiKey: key };
  throw new Error(
    "Set TMDB_READ_ACCESS_TOKEN or TMDB_API_KEY (see web/.env.example)",
  );
}

/**
 * @param revalidate  Seconds to keep the response in Next.js Data Cache.
 *   - 300  (5 min)  — browse lists, search, discover, trending (change frequently)
 *   - 3600 (1 hr)   — movie/TV detail pages (rarely change)
 *   - 21600 (6 hr)  — credits, videos, external IDs, watch providers
 *   - 86400 (24 hr) — person bio + filmography (very stable)
 */
export async function tmdbFetch<T>(
  path: string,
  params?: Record<string, string>,
  revalidate = 300,
): Promise<T> {
  const url = new URL(`${TMDB_API_BASE}${path}`);
  url.searchParams.set("language", "en-US");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }
  const auth = getTmdbAuth();
  const headers: HeadersInit = {};
  if (auth.kind === "bearer") {
    headers.Authorization = `Bearer ${auth.token}`;
  } else {
    url.searchParams.set("api_key", auth.apiKey);
  }
  const res = await fetch(url.toString(), { headers, next: { revalidate } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TMDb ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export type DiscoverResponse = {
  page: number;
  results: Array<{
    id: number;
    title: string;
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    release_date: string;
    vote_average: number;
    vote_count: number;
    popularity: number;
    genre_ids: number[];
  }>;
  total_pages: number;
};

export async function discoverMovies(searchParams: URLSearchParams) {
  return tmdbFetch<DiscoverResponse>("/discover/movie", Object.fromEntries(searchParams));
}

export type MovieDetailsResponse = {
  id: number;
  title: string;
  tagline?: string | null;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  runtime: number | null;
  genres: { id: number; name: string }[];
  spoken_languages?: { english_name: string; iso_639_1: string; name: string }[];
  original_language?: string;
  production_countries?: { iso_3166_1: string; name: string }[];
  production_companies?: { id: number; name: string; logo_path: string | null }[];
  status?: string;
  homepage?: string | null;
  imdb_id?: string | null;
};

export async function getMovieDetails(tmdbId: number) {
  return tmdbFetch<MovieDetailsResponse>(`/movie/${tmdbId}`, undefined, 3600);
}

export type MovieSearchResult = {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  vote_average: number;
};

export type MovieSearchResponse = {
  page: number;
  results: MovieSearchResult[];
  total_results: number;
};

export async function searchMovies(query: string, page = "1", includeAdult = false) {
  const q = query.trim();
  if (!q) {
    return { page: 1, results: [] as MovieSearchResult[], total_results: 0 };
  }
  return tmdbFetch<MovieSearchResponse>("/search/movie", {
    query: q,
    page,
    include_adult: includeAdult ? "true" : "false",
  }, 600);
}

export async function getPopularMovies(page = "1") {
  return tmdbFetch<DiscoverResponse>("/movie/popular", { page });
}

export async function getTrendingMovies(window: "day" | "week" = "week") {
  return tmdbFetch<DiscoverResponse>(`/trending/movie/${window}`);
}

export type NowPlayingResponse = {
  page: number;
  results: Array<{
    id: number;
    title: string;
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    release_date: string;
    vote_average: number;
    vote_count: number;
    popularity: number;
    genre_ids: number[];
  }>;
  total_pages: number;
  dates?: { maximum: string; minimum: string };
};

export async function getNowPlayingMovies(page = "1") {
  return tmdbFetch<NowPlayingResponse>("/movie/now_playing", { page });
}

// ---------------------------------------------------------------------------
// TV Shows
// ---------------------------------------------------------------------------

export type TVShowResult = {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
};

export type TVListResponse = {
  page: number;
  results: TVShowResult[];
  total_pages: number;
};

export type TVDetailsResponse = {
  id: number;
  name: string;
  tagline: string | null;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time: number[];
  status: string;
  homepage?: string | null;
  spoken_languages?: { english_name: string; iso_639_1: string; name: string }[];
  original_language?: string;
  production_countries?: { iso_3166_1: string; name: string }[];
  production_companies?: { id: number; name: string; logo_path: string | null }[];
  genres: { id: number; name: string }[];
  networks: { id: number; name: string; logo_path: string | null }[];
  seasons: {
    id: number;
    name: string;
    season_number: number;
    episode_count: number;
    poster_path: string | null;
    air_date: string | null;
    overview: string;
  }[];
};

export async function getPopularTV(page = "1") {
  return tmdbFetch<TVListResponse>("/tv/popular", { page });
}

export async function getTrendingTV(window: "day" | "week" = "week") {
  return tmdbFetch<TVListResponse>(`/trending/tv/${window}`);
}

export async function getNowAiringTV(page = "1") {
  return tmdbFetch<TVListResponse>("/tv/on_the_air", { page });
}

export async function discoverTV(searchParams: URLSearchParams) {
  return tmdbFetch<TVListResponse>("/discover/tv", Object.fromEntries(searchParams));
}

export async function getTVDetails(tmdbId: number) {
  return tmdbFetch<TVDetailsResponse>(`/tv/${tmdbId}`, undefined, 3600);
}

export type TVSearchResult = {
  id: number;
  name: string;
  first_air_date: string;
  poster_path: string | null;
  vote_average: number;
};

export async function searchTV(query: string, page = "1", includeAdult = false) {
  const q = query.trim();
  if (!q) return { page: 1, results: [] as TVSearchResult[], total_results: 0 };
  return tmdbFetch<{ page: number; results: TVSearchResult[]; total_results: number }>(
    "/search/tv",
    { query: q, page, include_adult: includeAdult ? "true" : "false" },
    600,
  );
}

// ---------------------------------------------------------------------------
// Rich details: credits, trailers, providers, people
// ---------------------------------------------------------------------------

export type TmdbCastMember = {
  id: number;
  name: string;
  character?: string;
  profile_path: string | null;
  known_for_department?: string;
  order?: number;
};

export type TmdbCrewMember = {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
};

export type CreditsResponse = {
  cast: TmdbCastMember[];
  crew: TmdbCrewMember[];
};

export type VideosResponse = {
  results: Array<{
    id: string;
    key: string;
    name: string;
    site: string;
    type: string;
    official: boolean;
    published_at?: string;
  }>;
};

export type ExternalIdsResponse = {
  imdb_id?: string | null;
  facebook_id?: string | null;
  instagram_id?: string | null;
  twitter_id?: string | null;
  wikidata_id?: string | null;
};

export type WatchProviderRegion = {
  link?: string;
  flatrate?: Array<{ provider_id: number; provider_name: string; logo_path: string | null }>;
  rent?: Array<{ provider_id: number; provider_name: string; logo_path: string | null }>;
  buy?: Array<{ provider_id: number; provider_name: string; logo_path: string | null }>;
};

export type WatchProvidersResponse = {
  results: Record<string, WatchProviderRegion>;
};

export async function getMovieCredits(tmdbId: number) {
  return tmdbFetch<CreditsResponse>(`/movie/${tmdbId}/credits`, undefined, 21600);
}

export async function getMovieVideos(tmdbId: number) {
  return tmdbFetch<VideosResponse>(`/movie/${tmdbId}/videos`, undefined, 21600);
}

export async function getMovieExternalIds(tmdbId: number) {
  return tmdbFetch<ExternalIdsResponse>(`/movie/${tmdbId}/external_ids`, undefined, 21600);
}

export async function getMovieWatchProviders(tmdbId: number) {
  return tmdbFetch<WatchProvidersResponse>(`/movie/${tmdbId}/watch/providers`, undefined, 21600);
}

export async function getTVCredits(tmdbId: number) {
  return tmdbFetch<CreditsResponse>(`/tv/${tmdbId}/credits`, undefined, 21600);
}

export async function getTVVideos(tmdbId: number) {
  return tmdbFetch<VideosResponse>(`/tv/${tmdbId}/videos`, undefined, 21600);
}

export async function getTVExternalIds(tmdbId: number) {
  return tmdbFetch<ExternalIdsResponse>(`/tv/${tmdbId}/external_ids`, undefined, 21600);
}

export async function getTVWatchProviders(tmdbId: number) {
  return tmdbFetch<WatchProvidersResponse>(`/tv/${tmdbId}/watch/providers`, undefined, 21600);
}

export type PersonDetailsResponse = {
  id: number;
  name: string;
  biography: string;
  profile_path: string | null;
  known_for_department: string | null;
  birthday: string | null;
  place_of_birth: string | null;
  popularity: number;
};

export type PersonCredit = {
  id: number;
  media_type: "movie" | "tv";
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  vote_average: number;
  popularity: number;
  character?: string;
  job?: string;
  department?: string;
};

export type PersonCreditsResponse = {
  cast: PersonCredit[];
  crew: PersonCredit[];
};

export async function getPersonDetails(personId: number) {
  return tmdbFetch<PersonDetailsResponse>(`/person/${personId}`, undefined, 86400);
}

export async function getPersonCombinedCredits(personId: number) {
  return tmdbFetch<PersonCreditsResponse>(`/person/${personId}/combined_credits`, undefined, 86400);
}

export async function getSimilarMovies(tmdbId: number, page = "1") {
  return tmdbFetch<DiscoverResponse>(`/movie/${tmdbId}/similar`, { page });
}
