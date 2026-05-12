import { searchMovies, searchTV } from "@/lib/tmdb/client";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_RESULTS = 20;

type Hit = {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  vote_average: number;
  mediaType: "movie" | "tv";
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("q") ?? "";
  const q = raw.trim();
  const type = searchParams.get("type") ?? "all"; // "movies" | "tv" | "all"

  if (q.length < 2) return NextResponse.json({ results: [], total_results: 0 });
  if (q.length > 120) return NextResponse.json({ error: "Query too long" }, { status: 400 });

  // Only allow adult results when the user has explicitly opted in and is 18+ verified
  const { data: profile } = await supabase
    .from("profiles")
    .select("show_mature_content, is_18_plus")
    .eq("id", user.id)
    .maybeSingle();
  const includeAdult = !!(profile?.is_18_plus && profile?.show_mature_content);

  try {
    let results: Hit[] = [];

    if (type === "movies") {
      const data = await searchMovies(q, "1", includeAdult);
      results = (data.results ?? []).slice(0, MAX_RESULTS).map((m) => ({
        id: m.id,
        title: m.title,
        release_date: m.release_date,
        poster_path: m.poster_path,
        vote_average: m.vote_average,
        mediaType: "movie",
      }));
    } else if (type === "tv") {
      const data = await searchTV(q, "1", includeAdult);
      results = (data.results ?? []).slice(0, MAX_RESULTS).map((m) => ({
        id: m.id,
        title: m.name,
        release_date: m.first_air_date,
        poster_path: m.poster_path,
        vote_average: m.vote_average,
        mediaType: "tv",
      }));
    } else {
      // "all" — run both in parallel, interleave results
      const [movies, shows] = await Promise.all([
        searchMovies(q, "1", includeAdult),
        searchTV(q, "1", includeAdult),
      ]);
      const movieHits: Hit[] = (movies.results ?? []).slice(0, 8).map((m) => ({
        id: m.id,
        title: m.title,
        release_date: m.release_date,
        poster_path: m.poster_path,
        vote_average: m.vote_average,
        mediaType: "movie",
      }));
      const tvHits: Hit[] = (shows.results ?? []).slice(0, 7).map((m) => ({
        id: m.id,
        title: m.name,
        release_date: m.first_air_date,
        poster_path: m.poster_path,
        vote_average: m.vote_average,
        mediaType: "tv",
      }));
      // Interleave movies and TV for relevance mix
      const len = Math.max(movieHits.length, tvHits.length);
      for (let i = 0; i < len; i++) {
        if (movieHits[i]) results.push(movieHits[i]);
        if (tvHits[i]) results.push(tvHits[i]);
      }
      results = results.slice(0, MAX_RESULTS);
    }

    return NextResponse.json({ results, total_results: results.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Search failed";
    const status = message.includes("TMDB_") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
