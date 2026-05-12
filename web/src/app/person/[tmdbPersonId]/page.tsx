import { getPersonCombinedCredits, getPersonDetails, type PersonCredit } from "@/lib/tmdb/client";
import { browseMediaPath } from "@/lib/media-slug";
import { posterUrl } from "@/lib/tmdb/constants";
import TmdbImage from "@/components/ui/TmdbImage";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PersonFilmographyClient } from "./PersonFilmographyClient";
import type { Metadata } from "next";

/**
 * Person pages contain only TMDb data — no auth, no cookies.
 * Eligible for full ISR: the rendered HTML is cached at the edge for 24 hours
 * and served without invoking a serverless function on subsequent requests.
 */
export const revalidate = 86400; // 24 hours

type Props = {
  params: Promise<{ tmdbPersonId: string }>;
};

function mediaHref(credit: PersonCredit): string {
  const label = credit.title ?? credit.name ?? "Unknown";
  return browseMediaPath(label, credit.id, credit.media_type);
}

function dedupeCredits(credits: PersonCredit[]): PersonCredit[] {
  const byKey = new Map<string, PersonCredit>();
  for (const credit of credits) {
    const key = `${credit.media_type}:${credit.id}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, credit);
      continue;
    }
    const existingScore = (existing.popularity ?? 0) + (existing.vote_average ?? 0);
    const nextScore = (credit.popularity ?? 0) + (credit.vote_average ?? 0);
    if (nextScore > existingScore) byKey.set(key, credit);
  }
  return [...byKey.values()];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tmdbPersonId: rawId } = await params;
  const personId = Number(rawId);
  if (!Number.isFinite(personId)) return {};
  try {
    const person = await getPersonDetails(personId);
    return {
      title: `${person.name} · Nudge Film`,
      description: person.biography?.trim().slice(0, 160) || `Browse ${person.name}'s filmography on Nudge Film.`,
    };
  } catch {
    return {};
  }
}

export default async function PersonPage({ params }: Props) {
  const { tmdbPersonId: rawId } = await params;
  const personId = Number(rawId);
  if (!Number.isFinite(personId)) notFound();

  let person;
  let credits;
  try {
    [person, credits] = await Promise.all([
      getPersonDetails(personId),
      getPersonCombinedCredits(personId),
    ]);
  } catch {
    notFound();
  }

  const allCredits: PersonCredit[] = dedupeCredits([
    ...(credits.cast ?? []).map((c) => ({ ...c, media_type: c.media_type ?? "movie" })),
    ...(credits.crew ?? []).map((c) => ({ ...c, media_type: c.media_type ?? "movie" })),
  ].filter((c) => c.media_type === "movie" || c.media_type === "tv"));

  const knownFor = [...allCredits]
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 8);

  const profile = posterUrl(person.profile_path, "w500");

  return (
    <article className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/browse"
        className="mb-4 inline-flex min-h-10 items-center rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
      >
        ← Back
      </Link>

      <section className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900">
            {profile ? (
              <TmdbImage src={profile} alt={person.name} fill className="object-cover" sizes="280px" />
            ) : null}
          </div>
          <div className="mt-3 space-y-1 text-sm text-zinc-300">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              {person.known_for_department || "Film"}
            </p>
            {person.birthday ? <p>Born: {person.birthday}</p> : null}
            {person.place_of_birth ? <p>{person.place_of_birth}</p> : null}
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">{person.name}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300">
            {person.biography?.trim() || "No biography available."}
          </p>

          <div className="mt-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Known for
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {knownFor.map((credit) => {
                const title = credit.title || credit.name || "Untitled";
                const poster = posterUrl(credit.poster_path, "w342");
                return (
                  <Link
                    key={`known-${credit.media_type}-${credit.id}-${title}`}
                    href={mediaHref(credit)}
                    className="group rounded-xl border border-white/10 bg-black/20 p-2"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900">
                      {poster ? (
                        <TmdbImage
                          src={poster}
                          alt={title}
                          fill
                          className="object-cover transition group-hover:scale-[1.03]"
                          sizes="200px"
                        />
                      ) : null}
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-zinc-200">{title}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Filmography — filtering/sorting is handled client-side so this page stays ISR-cacheable */}
      <Suspense
        fallback={
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-2">
                <div className="aspect-[2/3] animate-pulse rounded-lg bg-zinc-800" />
                <div className="mt-2 h-3 animate-pulse rounded bg-zinc-800" />
              </div>
            ))}
          </div>
        }
      >
        <PersonFilmographyClient personId={personId} credits={allCredits} />
      </Suspense>
    </article>
  );
}
