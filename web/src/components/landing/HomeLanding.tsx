import { HomeLandingClient } from "@/components/landing/HomeLandingClient";
import { listFeedback } from "@/features/feedback/service";
import { createClient } from "@/lib/supabase/server";
import { discoverMovies, discoverTV, getTrendingMovies } from "@/lib/tmdb/client";

const landingVibes = ["Cozy", "Funny", "Emotional", "Intense", "Weird", "Hidden Gem", "Late Night"] as const;
type LandingVibe = (typeof landingVibes)[number];

function baseDiscoverParams() {
  const p = new URLSearchParams();
  p.set("include_adult", "false");
  p.set("vote_count.gte", "140");
  p.set("vote_average.gte", "6.2");
  p.set("sort_by", "popularity.desc");
  return p;
}

function paramsForVibe(vibe: LandingVibe) {
  const movie = baseDiscoverParams();
  const tv = baseDiscoverParams();
  switch (vibe) {
    case "Funny":
      movie.set("with_genres", "35");
      tv.set("with_genres", "35");
      break;
    case "Intense":
      movie.set("with_genres", "53,80,28");
      tv.set("with_genres", "10759,53,80");
      break;
    case "Cozy":
      movie.set("with_genres", "35,10749,10751");
      tv.set("with_genres", "35,10751,18");
      break;
    case "Emotional":
      movie.set("with_genres", "18,10749");
      tv.set("with_genres", "18,10749");
      break;
    case "Weird":
      movie.set("with_genres", "14,878,9648");
      tv.set("with_genres", "10765,9648,16");
      break;
    case "Late Night":
      movie.set("with_genres", "53,27");
      tv.set("with_genres", "9648,80,53");
      break;
    case "Hidden Gem":
      movie.set("sort_by", "vote_average.desc");
      movie.set("vote_count.lte", "9000");
      movie.set("with_genres", "18,80,36,9648");
      tv.set("sort_by", "vote_average.desc");
      tv.set("vote_count.lte", "6000");
      tv.set("with_genres", "18,80,9648");
      break;
  }
  return { movie, tv };
}

async function getLandingSuggestions() {
  const entries = await Promise.all(
    landingVibes.map(async (vibe) => {
      const { movie, tv } = paramsForVibe(vibe);
      const [movies, shows] = await Promise.all([
        discoverMovies(movie).catch(() => ({ results: [] })),
        discoverTV(tv).catch(() => ({ results: [] })),
      ]);
      const merged = [
        ...(movies.results ?? []).map((m) => ({
          id: m.id,
          title: m.title,
          poster_path: m.poster_path,
          genre_ids: m.genre_ids,
          mediaType: "movie" as const,
        })),
        ...(shows.results ?? []).map((s) => ({
          id: s.id,
          title: s.name,
          poster_path: s.poster_path,
          genre_ids: s.genre_ids,
          mediaType: "tv" as const,
        })),
      ].filter((x) => x.poster_path).slice(0, 6);

      return [vibe, merged] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<LandingVibe, Array<{
    id: number;
    title: string;
    poster_path: string | null;
    genre_ids: number[];
    mediaType: "movie" | "tv";
  }>>;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function HomeLanding() {
  const [reviews, supabase, trending, suggestionsByVibe] = await Promise.all([
    listFeedback(1),
    createClient(),
    getTrendingMovies("week").catch(() => ({ results: [] })),
    getLandingSuggestions(),
  ]);
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <HomeLandingClient
      user={user}
      reviews={reviews}
      heroMovies={trending.results ?? []}
      suggestionsByVibe={suggestionsByVibe}
    />
  );
}
