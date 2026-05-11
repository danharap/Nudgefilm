/**
 * Optional LLM-assisted re-ranking.
 *
 * Only called when OPENAI_API_KEY is set.
 * Always falls back to the engine output on any failure.
 * Never invents movies — only re-orders/filters the candidate list.
 */
import type { RecommendedMovie } from "@/types/movie";
import type { RecommendationInput } from "./schema";
import { llmResponseSchema } from "./llmRank.types";

type CandidateSummary = {
  id: number;
  title: string;
  genres: string;
  vote: number;
  year: number | null;
  overview: string;
};

function buildPrompt(
  candidates: CandidateSummary[],
  input: RecommendationInput,
): string {
  const vibesStr = input.vibes.length ? input.vibes.join(", ") : "none";
  const genreStr = (input.genres ?? []).length
    ? (input.genres ?? []).join(", ")
    : "none";
  const candidateJson = JSON.stringify(
    candidates.map((c) => ({
      id: c.id,
      title: c.title,
      genres: c.genres,
      vote: c.vote,
      year: c.year,
      overview: c.overview.slice(0, 200),
    })),
    null,
    2,
  );

  return `You are a movie recommendation assistant. You will receive a list of candidate movies (as JSON) and the user's preferences. Your job is to rank the movies that best match the user's preferences.

RULES:
1. You may ONLY use movie IDs from the candidate list. Do NOT invent new movies.
2. Return between 4 and 8 picks, ordered best-first.
3. If the user's vibes and genres conflict, write a brief, friendly conflictExplanation and still pick the closest matches.
4. Each pick needs a short reason (max 1 sentence, max 300 characters).
5. Respond ONLY with valid JSON matching this schema exactly — no markdown, no extra text:
   { "conflictExplanation": "...", "picks": [ { "id": <number>, "reason": "..." }, ... ] }
   conflictExplanation is optional; omit the key if there is no conflict.

User preferences:
- Vibes: ${vibesStr}
- Genres selected: ${genreStr}
- Min vote average: ${input.minVoteAverage}

Candidate movies:
${candidateJson}`;
}

/** Call OpenAI Chat Completions with a 10 s timeout. Returns null on any failure. */
async function callOpenAI(prompt: string): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1024,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Re-rank candidates using LLM if OPENAI_API_KEY is present.
 * Returns the (possibly reordered) movie list and a flag indicating whether LLM ran.
 */
export async function llmRerank(
  candidates: RecommendedMovie[],
  input: RecommendationInput,
): Promise<{ movies: RecommendedMovie[]; llmSkipped: boolean; conflictExplanation?: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || !candidates.length) {
    return { movies: candidates, llmSkipped: true };
  }

  const summaries: CandidateSummary[] = candidates.map((c) => ({
    id: c.id,
    title: c.title,
    genres: (c.genre_ids ?? [])
      .map((id) => `id:${id}`)
      .join(", "),
    vote: c.vote_average,
    year: c.release_year,
    overview: c.overview ?? "",
  }));

  const prompt = buildPrompt(summaries, input);
  const raw = await callOpenAI(prompt);
  if (!raw) return { movies: candidates, llmSkipped: true };

  const parsed = llmResponseSchema.safeParse(raw);
  if (!parsed.success) return { movies: candidates, llmSkipped: true };

  const { picks, conflictExplanation } = parsed.data;

  // Build a map of candidates by id.
  const byId = new Map<number, RecommendedMovie>(
    candidates.map((c) => [c.id, c]),
  );

  const reranked: RecommendedMovie[] = [];
  for (const pick of picks) {
    const movie = byId.get(pick.id);
    if (!movie) continue; // LLM hallucinated an unknown id — skip
    reranked.push({
      ...movie,
      reasons: [
        { label: pick.reason, kind: "llm" },
        ...movie.reasons.filter((r) => r.kind !== "llm"),
      ],
    });
  }

  if (!reranked.length) return { movies: candidates, llmSkipped: true };

  return {
    movies: reranked,
    llmSkipped: false,
    conflictExplanation,
  };
}
