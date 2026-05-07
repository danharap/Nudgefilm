import { HomeLandingClient } from "@/components/landing/HomeLandingClient";
import { listFeedback } from "@/features/feedback/service";
import { createClient } from "@/lib/supabase/server";
import { discoverMovies, discoverTV, getTrendingMovies } from "@/lib/tmdb/client";

const landingVibes = ["Cozy", "Funny", "Emotional", "Intense", "Adventurous", "Romantic", "Late Night"] as const;
type LandingVibe = (typeof landingVibes)[number];
type LandingSuggestion = {
  id: number;
  title: string;
  poster_path: string | null;
  genre_ids: number[];
  mediaType: "movie" | "tv";
  vote_average: number;
  vote_count: number;
};

function baseDiscoverParams() {
  const p = new URLSearchParams();
  p.set("include_adult", "false");
  p.set("vote_count.gte", "1200");
  p.set("vote_average.gte", "7.0");
  p.set("sort_by", "vote_average.desc");
  p.set("without_genres", "99");
  return p;
}

function paramsForVibe(vibe: LandingVibe) {
  const movie = baseDiscoverParams();
  const tv = baseDiscoverParams();
  switch (vibe) {
    case "Funny":
      movie.set("with_genres", "35");
      movie.set("without_genres", "27,53,80");
      movie.set("vote_average.gte", "7.1");
      movie.set("vote_count.gte", "2200");
      // Keep the demo "funny" lane movie-centric to avoid noisy TV results.
      tv.set("with_genres", "0");
      break;
    case "Intense":
      movie.set("with_genres", "53,80,28");
      tv.set("with_genres", "10759,53,80");
      movie.set("vote_average.gte", "6.9");
      tv.set("vote_average.gte", "7.0");
      break;
    case "Cozy":
      movie.set("with_genres", "35,10749,10751");
      tv.set("with_genres", "35,10751,18");
      break;
    case "Emotional":
      movie.set("with_genres", "18,10749");
      tv.set("with_genres", "18,10749");
      break;
    case "Adventurous":
      movie.set("with_genres", "12,28,14");
      tv.set("with_genres", "10759,10765,16");
      movie.set("vote_average.gte", "6.8");
      tv.set("vote_average.gte", "6.9");
      break;
    case "Late Night":
      movie.set("with_genres", "53,27");
      tv.set("with_genres", "9648,80,53");
      break;
    case "Romantic":
      movie.set("with_genres", "10749,35,18");
      tv.set("with_genres", "10749,35,18");
      movie.set("vote_average.gte", "7.0");
      tv.set("vote_average.gte", "7.0");
      break;
  }
  return { movie, tv };
}

function normalizeTitle(t: string) {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function rankSuggestion(s: LandingSuggestion) {
  return s.vote_average * 100 + Math.log10(Math.max(10, s.vote_count)) * 8;
}

async function getLandingSuggestions() {
  const entries = await Promise.all(
    landingVibes.map(async (vibe) => {
      const { movie, tv } = paramsForVibe(vibe);
      const [movies, shows] = await Promise.all([
        discoverMovies(movie).catch(() => ({ results: [] })),
        discoverTV(tv).catch(() => ({ results: [] })),
      ]);
      const merged: LandingSuggestion[] = [
        ...(movies.results ?? []).map((m) => ({
          id: m.id,
          title: m.title,
          poster_path: m.poster_path,
          genre_ids: m.genre_ids,
          mediaType: "movie" as const,
          vote_average: m.vote_average,
          vote_count: m.vote_count,
        })),
        ...(vibe === "Funny"
          ? []
          : (shows.results ?? []).map((s) => ({
          id: s.id,
          title: s.name,
          poster_path: s.poster_path,
          genre_ids: s.genre_ids,
          mediaType: "tv" as const,
          vote_average: s.vote_average,
          vote_count: s.vote_count,
        }))),
      ].filter((x) => x.poster_path);

      const deduped = new Map<string, LandingSuggestion>();
      for (const item of merged.sort((a, b) => rankSuggestion(b) - rankSuggestion(a))) {
        const key = `${item.mediaType}:${normalizeTitle(item.title)}`;
        if (!deduped.has(key)) deduped.set(key, item);
      }
      const selected = Array.from(deduped.values()).slice(0, 6);

      return [vibe, selected] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<LandingVibe, LandingSuggestion[]>;
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
