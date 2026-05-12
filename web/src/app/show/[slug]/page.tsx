import { ShowPersonalizedSection } from "./ShowPersonalizedSection";
import { ShowTabsPanel } from "./ShowTabsPanel";
import {
  getTVCredits,
  getTVDetails,
  getTVExternalIds,
  getTVVideos,
  getTVWatchProviders,
} from "@/lib/tmdb/client";
import { posterUrl } from "@/lib/tmdb/constants";
import { getConfiguredOrigin } from "@/lib/site-url";
import TmdbImage from "@/components/ui/TmdbImage";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import {
  parseTrailingTmdbIdFromSlugParam,
  tvDetailSegment,
} from "@/lib/media-slug";
import { cache } from "react";
import type { Metadata } from "next";
import { Suspense } from "react";

// Cache deduplicates the TMDb details call between generateMetadata and the page render
const cachedTVDetails = cache((tmdbId: number) => getTVDetails(tmdbId));

// ISR: show detail data is valid for 1 hour. User-specific data loads client-side.
export const revalidate = 3600;

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const tmdbId = parseTrailingTmdbIdFromSlugParam(decodeURIComponent(rawSlug));
  if (tmdbId === null) return {};
  try {
    const show = await cachedTVDetails(tmdbId);
    const origin = getConfiguredOrigin();
    const canonical = tvDetailSegment(show.name, tmdbId);
    return {
      title: `${show.name} (${show.first_air_date?.slice(0, 4) ?? "—"}) · Nudge Film`,
      description: show.overview?.trim().slice(0, 200) || undefined,
      openGraph: {
        title: show.name,
        description: show.overview?.trim().slice(0, 200) || undefined,
        url: `${origin}/show/${canonical}`,
        images: show.poster_path
          ? [{ url: `https://image.tmdb.org/t/p/w500${show.poster_path}`, width: 500, height: 750 }]
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

export default async function ShowDetailPage({ params }: Props) {
  const { slug: rawSlug } = await params;
  const raw = decodeURIComponent(rawSlug);
  const tmdbId = parseTrailingTmdbIdFromSlugParam(raw);
  if (tmdbId === null) notFound();

  let show;
  let credits;
  let videos;
  let externalIds;
  let watchProviders;
  try {
    [show, credits, videos, externalIds, watchProviders] = await Promise.all([
      cachedTVDetails(tmdbId),
      getTVCredits(tmdbId),
      getTVVideos(tmdbId),
      getTVExternalIds(tmdbId),
      getTVWatchProviders(tmdbId),
    ]);
  } catch {
    notFound();
  }

  const canonicalSegment = tvDetailSegment(show.name, tmdbId);
  if (raw !== canonicalSegment) {
    permanentRedirect(`/show/${canonicalSegment}`);
  }

  const backdrop = posterUrl(show.backdrop_path, "w1280");
  const poster = posterUrl(show.poster_path, "w500");
  const providerRegion = watchProviders.results?.CA ?? null;
  const trailerUrl = pickTrailer(videos.results ?? []);
  const directors = credits.crew.filter((m) => m.job === "Director");
  const producers = credits.crew.filter((m) => m.job === "Executive Producer" || m.job === "Producer");
  const writers = credits.crew.filter((m) => m.job === "Writer" || m.job === "Screenplay");
  const similarHref = `/recommend?source=tv&title=${encodeURIComponent(show.name)}&genres=${encodeURIComponent((show.genres ?? []).map((g) => g.id).join(","))}&fromTmdbId=${tmdbId}`;
  const shareUrl = `${getConfiguredOrigin()}/show/${canonicalSegment}`;
  const year = show.first_air_date?.slice(0, 4);
  const runtime =
    show.episode_run_time?.length > 0 ? `~${show.episode_run_time[0]} min / ep` : null;

  // Only non-special seasons for display and for passing season IDs to the personalized section
  const seasons = (show.seasons ?? []).filter((s) => s.season_number > 0);

  const externalIdLinks = {
    tmdb: `https://www.themoviedb.org/tv/${tmdbId}`,
    imdb: externalIds.imdb_id ? `https://www.imdb.com/title/${externalIds.imdb_id}` : null,
    homepage: show.homepage || null,
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
              <TmdbImage src={poster} alt={show.name} fill className="object-cover" sizes="208px" />
            ) : null}
          </div>

          {/* Static metadata */}
          <div className="space-y-4 text-center lg:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <span className="rounded-full bg-violet-600/20 px-2.5 py-0.5 text-xs font-semibold text-violet-300 ring-1 ring-violet-500/20">
                TV Series
              </span>
              {show.status && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                  show.status === "Ended"
                    ? "bg-zinc-800 text-zinc-400 ring-white/10"
                    : "bg-green-500/15 text-green-400 ring-green-500/20"
                }`}>
                  {show.status}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-semibold text-white sm:text-3xl md:text-4xl lg:text-5xl">{show.name}</h1>

            {show.tagline && (
              <p className="text-sm italic text-zinc-500">&ldquo;{show.tagline}&rdquo;</p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-zinc-300/90 lg:justify-start">
              {year && <span>{year}</span>}
              {year && <span>·</span>}
              <span>
                ★ {show.vote_average?.toFixed(1)}{" "}
                <span className="text-zinc-500">({show.vote_count?.toLocaleString()} votes)</span>
              </span>
              <span>·</span>
              <span>{show.number_of_seasons} season{show.number_of_seasons !== 1 ? "s" : ""}</span>
              <span>·</span>
              <span>{show.number_of_episodes} episodes</span>
              {runtime && (
                <>
                  <span>·</span>
                  <span>{runtime}</span>
                </>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-2 md:justify-start">
              {(show.genres ?? []).map((g) => (
                <Link
                  key={g.id}
                  href={`/recommend?source=tv&genres=${g.id}`}
                  prefetch={false}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-zinc-300"
                >
                  {g.name}
                </Link>
              ))}
            </div>

            {show.networks && show.networks.length > 0 ? (
              <p className="text-xs text-zinc-500">
                {show.networks.map((n) => n.name).join(", ")}
              </p>
            ) : null}

            <p className="max-w-3xl text-sm leading-relaxed text-zinc-300">
              {show.overview || "No synopsis available."}
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
            <ShowPersonalizedSection
              tmdbId={tmdbId}
              slug={canonicalSegment}
              similarHref={similarHref}
              trailerUrl={trailerUrl}
              shareUrl={shareUrl}
              episodeRunTime={show.episode_run_time?.[0] ?? null}
              showName={show.name}
              seasons={seasons}
            />
          </Suspense>
        </section>

        {/* Tabs: cast, crew, details, genres, availability — client-side tab switching */}
        <Suspense fallback={null}>
          <ShowTabsPanel
            slug={canonicalSegment}
            tmdbId={tmdbId}
            cast={credits.cast}
            directors={directors}
            writers={writers}
            producers={producers}
            genres={show.genres ?? []}
            runtime={runtime}
            spokenLanguages={show.spoken_languages?.map((l) => l.english_name).join(", ") || show.original_language || "—"}
            firstAirDate={show.first_air_date || "—"}
            countries={show.production_countries?.map((c) => c.name).join(", ") || "—"}
            companies={show.production_companies?.slice(0, 4).map((c) => c.name).join(", ") || "—"}
            statusLine={`Status: ${show.status || "—"} · TMDb ${show.vote_average?.toFixed(1)} (${show.vote_count?.toLocaleString()})`}
            providerRegion={providerRegion}
          />
        </Suspense>

        {/* Browse back */}
        <div className="mt-12">
          <Link href="/browse?type=tv" prefetch={false} className="text-sm text-zinc-500 transition hover:text-zinc-300">
            ← Browse more TV shows
          </Link>
        </div>
      </div>
    </article>
  );
}
