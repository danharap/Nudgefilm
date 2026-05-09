import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchMovies } from "@/lib/tmdb/client";

export interface MatchInput {
  title: string;
  year: number | null;
  index: number;
}

export type MatchConfidence = "high" | "medium" | "low" | "none";

export interface MatchCandidate {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  voteAverage: number;
}

export interface MatchResult {
  index: number;
  title: string;
  year: number | null;
  confidence: MatchConfidence;
  /** Best auto-match (high/medium confidence) */
  matched: MatchCandidate | null;
  /** Top candidates for user to pick from (low/none confidence) */
  candidates: MatchCandidate[];
}

export interface MatchRequestBody {
  movies: MatchInput[];
}

export interface MatchResponseBody {
  results: MatchResult[];
}

function getYear(releaseDate: string | undefined | null): number | null {
  if (!releaseDate) return null;
  const n = parseInt(releaseDate.slice(0, 4), 10);
  return Number.isFinite(n) ? n : null;
}

function scoreTitle(a: string, b: string): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[''`]/g, "'")
      .replace(/[^a-z0-9' ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  return normalize(a) === normalize(b) ? 1 : 0;
}

async function matchMovie(input: MatchInput): Promise<MatchResult> {
  const { title, year, index } = input;

  let results;
  try {
    const res = await searchMovies(title);
    results = res.results;
  } catch {
    return { index, title, year, confidence: "none", matched: null, candidates: [] };
  }

  if (!results || results.length === 0) {
    return { index, title, year, confidence: "none", matched: null, candidates: [] };
  }

  const candidates: MatchCandidate[] = results.slice(0, 5).map((r) => ({
    tmdbId: r.id,
    title: r.title,
    year: getYear(r.release_date),
    posterPath: r.poster_path,
    voteAverage: r.vote_average,
  }));

  // Try to find best match
  for (const r of results) {
    const tmdbYear = getYear(r.release_date);
    const titleMatch = scoreTitle(r.title, title) === 1;

    if (titleMatch && year !== null && tmdbYear === year) {
      return {
        index,
        title,
        year,
        confidence: "high",
        matched: {
          tmdbId: r.id,
          title: r.title,
          year: tmdbYear,
          posterPath: r.poster_path,
          voteAverage: r.vote_average,
        },
        candidates,
      };
    }
  }

  // Medium: title matches but year off by 1
  for (const r of results) {
    const tmdbYear = getYear(r.release_date);
    const titleMatch = scoreTitle(r.title, title) === 1;

    if (titleMatch && year !== null && tmdbYear !== null && Math.abs(tmdbYear - year) <= 1) {
      return {
        index,
        title,
        year,
        confidence: "medium",
        matched: {
          tmdbId: r.id,
          title: r.title,
          year: tmdbYear,
          posterPath: r.poster_path,
          voteAverage: r.vote_average,
        },
        candidates,
      };
    }
  }

  // Low: title matches but year doesn't
  for (const r of results) {
    const tmdbYear = getYear(r.release_date);
    const titleMatch = scoreTitle(r.title, title) === 1;

    if (titleMatch) {
      return {
        index,
        title,
        year,
        confidence: "low",
        matched: {
          tmdbId: r.id,
          title: r.title,
          year: tmdbYear,
          posterPath: r.poster_path,
          voteAverage: r.vote_average,
        },
        candidates,
      };
    }
  }

  // No match
  return { index, title, year, confidence: "none", matched: null, candidates };
}

const MATCH_CONCURRENCY = 8;

/** Run async work over items with bounded parallelism; preserves order. */
async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: MatchRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { movies } = body;
  if (!Array.isArray(movies) || movies.length === 0) {
    return NextResponse.json({ results: [] } satisfies MatchResponseBody);
  }

  // Cap batch size to 50 per request
  const batch = movies.slice(0, 50);
  if (batch.length === 0) {
    return NextResponse.json({ results: [] } satisfies MatchResponseBody);
  }

  const results = await mapPool(batch, MATCH_CONCURRENCY, (movie) => matchMovie(movie));

  return NextResponse.json({ results } satisfies MatchResponseBody);
}
