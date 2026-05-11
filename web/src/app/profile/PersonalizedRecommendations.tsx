import { getPersonalizedRecommendations } from "@/features/recommendations/personalized";
import { TMDB_GENRE_BY_ID } from "@/config/tmdbGenres";
import { movieDetailPath } from "@/lib/media-slug";
import { posterUrl } from "@/lib/tmdb/constants";
import type { RecommendedMovie } from "@/types/movie";
import TmdbImage from "@/components/ui/TmdbImage";
import Link from "next/link";

// ─── Compact carousel card ─────────────────────────────────────────────────

function PersonalizedMovieCard({ movie }: { movie: RecommendedMovie }) {
  const poster = posterUrl(movie.poster_path, "w342");
  const href = movieDetailPath(movie.title, movie.id);
  const primaryReason = movie.reasons[0];

  return (
    <article className="group w-[120px] shrink-0 sm:w-[132px]">
      <Link
        href={href}
        className="relative block aspect-[2/3] overflow-hidden rounded-xl bg-zinc-800 ring-0 transition hover:ring-1 hover:ring-indigo-400/40"
        title={movie.title}
      >
        {poster ? (
          <TmdbImage
            src={poster}
            alt={movie.title}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.04]"
            sizes="132px"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-center text-[10px] leading-tight text-zinc-500">
            {movie.title}
          </div>
        )}
        {/* Rating badge */}
        {movie.vote_average > 0 ? (
          <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-200 ring-1 ring-white/10">
            ★ {movie.vote_average.toFixed(1)}
          </span>
        ) : null}
      </Link>

      <div className="mt-2 space-y-1 px-0.5">
        <Link
          href={href}
          className="block truncate text-xs font-medium leading-tight text-primary transition hover:text-indigo-400"
        >
          {movie.title}
        </Link>
        {movie.release_year ? (
          <p className="text-[10px] text-tertiary">{movie.release_year}</p>
        ) : null}
        {primaryReason ? (
          <p className="line-clamp-2 text-[10px] leading-tight text-indigo-400/80">
            {primaryReason.label}
          </p>
        ) : null}
      </div>
    </article>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

export function PersonalizedRecommendationsSkeleton() {
  return (
    <section className="mb-12">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="h-5 w-48 animate-pulse rounded-md bg-zinc-800" />
          <div className="mt-1 h-3 w-32 animate-pulse rounded-md bg-zinc-800/60" />
        </div>
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-[120px] shrink-0 sm:w-[132px]">
            <div className="aspect-[2/3] animate-pulse rounded-xl bg-zinc-800" />
            <div className="mt-2 space-y-1.5">
              <div className="h-3 w-20 animate-pulse rounded bg-zinc-800" />
              <div className="h-2.5 w-14 animate-pulse rounded bg-zinc-800/60" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Server component ─────────────────────────────────────────────────────────

export async function PersonalizedRecommendations({ userId }: { userId: string }) {
  let result;
  try {
    result = await getPersonalizedRecommendations(userId);
  } catch {
    return null;
  }

  const { movies, tasteProfile } = result;

  // Not enough history yet
  if (tasteProfile.totalEntries < 3) {
    return (
      <section className="mb-12">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Recommended for you</h2>
            <p className="text-xs text-zinc-500">Based on your recent watches</p>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 px-6 py-10 text-center">
          <p className="text-sm text-zinc-400">Log a few more films to get personalised picks.</p>
          <Link
            href="/browse"
            className="mt-4 inline-block text-sm font-medium text-indigo-300 transition hover:text-indigo-200"
          >
            Browse films →
          </Link>
        </div>
      </section>
    );
  }

  if (movies.length === 0) return null;

  // Build top genre label
  const topGenreIds = [...tasteProfile.genreWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([id]) => id);
  const topGenreLabel = topGenreIds
    .map((id) => TMDB_GENRE_BY_ID[id])
    .filter(Boolean)
    .join(" & ");

  return (
    <section className="mb-12">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Recommended for you</h2>
          <p className="text-xs text-zinc-500">
            {topGenreLabel ? `Based on your love of ${topGenreLabel}` : "Based on your recent watches"}
          </p>
        </div>
        <Link
          href="/recommend"
          className="text-xs text-indigo-300/70 transition hover:text-indigo-200"
        >
          Find a film →
        </Link>
      </div>

      {/* Horizontal scroll row */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {movies.map((movie) => (
            <PersonalizedMovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      </div>
    </section>
  );
}
