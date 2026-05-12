import { MoviePersonalizedSection } from "./MoviePersonalizedSection";
import { MovieTabsPanel } from "./MovieTabsPanel";
import {
  getMovieCredits,
  getMovieDetails,
  getMovieExternalIds,
  getMovieVideos,
  getMovieWatchProviders,
} from "@/lib/tmdb/client";
import { posterUrl } from "@/lib/tmdb/constants";
import { getConfiguredOrigin } from "@/lib/site-url";
import TmdbImage from "@/components/ui/TmdbImage";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import {
  movieDetailSegment,
  parseTrailingTmdbIdFromSlugParam,
} from "@/lib/media-slug";
import { cache } from "react";
import type { Metadata } from "next";
import { Suspense } from "react";

// Cache deduplicates the TMDb details call between generateMetadata and the page render
const cachedMovieDetails = cache((tmdbId: number) => getMovieDetails(tmdbId));

// ISR: movie detail data is valid for 1 hour. User-specific data loads client-side.
export const revalidate = 3600;

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const tmdbId = parseTrailingTmdbIdFromSlugParam(decodeURIComponent(rawSlug));
  if (tmdbId === null) return {};
  try {
    const movie = await cachedMovieDetails(tmdbId);
    const origin = getConfiguredOrigin();
    const canonical = movieDetailSegment(movie.title, tmdbId);
    return {
      title: `${movie.title} (${movie.release_date?.slice(0, 4) ?? "—"}) · Nudge Film`,
      description: movie.overview?.trim().slice(0, 200) || undefined,
      openGraph: {
        title: movie.title,
        description: movie.overview?.trim().slice(0, 200) || undefined,
        url: `${origin}/movie/${canonical}`,
        images: movie.poster_path
          ? [{ url: `https://image.tmdb.org/t/p/w500${movie.poster_path}`, width: 500, height: 750 }]
          : [],
      },
    };
  } catch {
    return {};
  }
}

function pickTrailer(videos: Array<{ key: string; site: string; type: string; official: boolean }>) {
  const yt = videos.filter((v) => v.site === "YouTube");
  const best =
    yt.find((v) => v.official && v.type === "Trailer") ??
    yt.find((v) => v.type === "Trailer") ??
    yt.find((v) => v.type === "Teaser") ??
    yt[0];
  return best ? `https://www.youtube.com/watch?v=${best.key}` : null;
}

export default async function MovieDetailPage({ params }: Props) {
  const { slug: rawSlug } = await params;
  const raw = decodeURIComponent(rawSlug);
  const tmdbId = parseTrailingTmdbIdFromSlugParam(raw);
  if (tmdbId === null) notFound();

  let movie;
  let credits;
  let videos;
  let externalIds;
  let watchProviders;
  try {
    [movie, credits, videos, externalIds, watchProviders] = await Promise.all([
      cachedMovieDetails(tmdbId),
      getMovieCredits(tmdbId),
      getMovieVideos(tmdbId),
      getMovieExternalIds(tmdbId),
      getMovieWatchProviders(tmdbId),
    ]);
  } catch {
    notFound();
  }

  const canonicalSegment = movieDetailSegment(movie.title, tmdbId);
  if (raw !== canonicalSegment) {
    permanentRedirect(`/movie/${canonicalSegment}`);
  }

  const backdrop = posterUrl(movie.backdrop_path, "w1280");
  const poster = posterUrl(movie.poster_path, "w500");
  const providerRegion = watchProviders.results?.CA ?? null;
  const trailerUrl = pickTrailer(videos.results ?? []);
  const director = credits.crew.find((m) => m.job === "Director");
  const directors = credits.crew.filter((m) => m.job === "Director");
  const writers = credits.crew.filter((m) => m.job === "Writer" || m.job === "Screenplay");
  const producers = credits.crew.filter((m) => m.job === "Producer");
  const similarHref = `/recommend?source=movie&title=${encodeURIComponent(movie.title)}&genres=${encodeURIComponent(movie.genres.map((g) => g.id).join(","))}&fromTmdbId=${tmdbId}`;
  const shareUrl = `${getConfiguredOrigin()}/movie/${canonicalSegment}`;

  const externalIdLinks = {
    tmdb: `https://www.themoviedb.org/movie/${tmdbId}`,
    imdb: externalIds.imdb_id ? `https://www.imdb.com/title/${externalIds.imdb_id}` : null,
    homepage: movie.homepage || null,
  };

  return (
    <article className="pb-16">
      {/* Backdrop */}
      <div className="relative h-[48vh] min-h-[280px] w-full overflow-hidden sm:h-[56vh] sm:min-h-[360px]">
        {backdrop ? (
          <TmdbImage
            src={backdrop}
            alt=""
            fill
            className="object-cover opacity-60"
            priority
            sizes="100vw"
            aria-hidden
          />
        ) : (
          <div className="h-full bg-zinc-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050507] via-[#070708]/88 to-[#070708]/30" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[#070708]" />
      </div>

      <div className="relative z-10 mx-auto -mt-24 max-w-6xl px-4 sm:-mt-32 sm:px-6 lg:-mt-40">
        <section className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)_340px] lg:items-start">
          {/* Poster */}
          <div className="relative mx-auto aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl sm:w-52 lg:mx-0">
            {poster ? (
              <TmdbImage src={poster} alt={movie.title} fill className="object-cover" sizes="208px" />
            ) : null}
          </div>

          {/* Static metadata */}
          <div className="space-y-4 text-center lg:text-left">
            <h1 className="text-2xl font-semibold text-white sm:text-3xl md:text-4xl lg:text-5xl">
              {movie.title}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-zinc-300/90 lg:justify-start">
              <span>{movie.release_date?.slice(0, 4)}</span>
              {director ? (
                <span>
                  · Directed by{" "}
                  <Link href={`/person/${director.id}`} prefetch={false} className="text-zinc-100 hover:text-indigo-300">
                    {director.name}
                  </Link>
                </span>
              ) : null}
              <span>
                ★ {movie.vote_average?.toFixed(1)}{" "}
                <span className="text-zinc-500">({movie.vote_count?.toLocaleString()} votes)</span>
              </span>
              <span>·</span>
              <span>{movie.runtime ?? "—"} min</span>
            </div>

            <div className="flex flex-wrap justify-center gap-2 md:justify-start">
              {movie.genres.map((g) => (
                <Link
                  key={g.id}
                  href={`/recommend?genres=${g.id}`}
                  prefetch={false}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-zinc-300"
                >
                  {g.name}
                </Link>
              ))}
            </div>

            <p className="max-w-3xl text-sm leading-relaxed text-zinc-300">
              {movie.overview || "No synopsis available."}
            </p>

            <div className="flex flex-wrap justify-center gap-2 text-xs text-zinc-400 lg:justify-start">
              <a href={externalIdLinks.tmdb} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/10 px-3 py-1 hover:text-white">TMDb</a>
              {externalIdLinks.imdb ? <a href={externalIdLinks.imdb} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/10 px-3 py-1 hover:text-white">IMDb</a> : null}
              {externalIdLinks.homepage ? <a href={externalIdLinks.homepage} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/10 px-3 py-1 hover:text-white">Official Site</a> : null}
              {trailerUrl ? <a href={trailerUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-indigo-200">Trailer</a> : null}
            </div>
          </div>

          {/* Personalized section: action panel, user rating, social data — loads client-side */}
          <Suspense fallback={null}>
            <MoviePersonalizedSection
              tmdbId={tmdbId}
              slug={canonicalSegment}
              similarHref={similarHref}
              trailerUrl={trailerUrl}
              shareUrl={shareUrl}
            />
          </Suspense>
        </section>

        {/* Tabs: cast, crew, details, genres, availability — client-side tab switching */}
        <Suspense fallback={null}>
          <MovieTabsPanel
            slug={canonicalSegment}
            cast={credits.cast}
            directors={directors}
            writers={writers}
            producers={producers}
            genres={movie.genres}
            runtime={movie.runtime}
            spokenLanguages={movie.spoken_languages?.map((l) => l.english_name).join(", ") || movie.original_language || "—"}
            releaseDate={movie.release_date || "—"}
            countries={movie.production_countries?.map((c) => c.name).join(", ") || "—"}
            companies={movie.production_companies?.slice(0, 4).map((c) => c.name).join(", ") || "—"}
            statusLine={`Status: ${movie.status || "—"} · TMDb ${movie.vote_average?.toFixed(1)} (${movie.vote_count?.toLocaleString()})`}
            providerRegion={providerRegion}
            externalIdLinks={externalIdLinks}
          />
        </Suspense>
      </div>
    </article>
  );
}
