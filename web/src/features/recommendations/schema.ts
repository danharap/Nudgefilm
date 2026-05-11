import { z } from "zod";

const recommendationInputBaseSchema = z.object({
  /** Mood chips; map to TMDb genre buckets when no explicit genres are chosen. */
  vibes: z.array(z.string().trim().min(1)).max(8).default([]),
  genres: z.array(z.number().int()).optional().default([]),
  runtimeMin: z.number().int().min(0).optional(),
  runtimeMax: z.number().int().min(0).optional(),
  minVoteAverage: z.number().min(0).max(10).optional().default(6),
  eraMinYear: z.number().int().min(1900).max(2035).optional(),
  eraMaxYear: z.number().int().min(1900).max(2035).optional(),
  language: z.string().length(2).optional(),
  streamingOnly: z.boolean().optional().default(false),
  watchRegion: z.string().length(2).optional(),
});

export const recommendationInputSchema = recommendationInputBaseSchema.superRefine(
  (val, ctx) => {
    const hasGenres = (val.genres?.length ?? 0) > 0;
    const hasVibes = val.vibes.length > 0;
    if (!hasGenres && !hasVibes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pick at least one genre or one vibe",
        path: ["genres"],
      });
    }
  },
);

export type RecommendationInput = z.infer<typeof recommendationInputSchema>;
