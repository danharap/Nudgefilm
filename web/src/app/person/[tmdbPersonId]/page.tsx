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
 * Eligible for full ISR: the rendered HTML is cached at the edge for 24 hours.
 */
export const revalidate = 86400;

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

function formatDate(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return raw;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tmdbPersonId: rawId } = await params;
  const personId = Number(rawId);
  if (!Number.isFinite(personId)) return {};
  try {
    const person = await getPersonDetails(personId);
    return {
      title: `${person.name} · Nudge Film`,
      description:
        person.biography?.trim().slice(0, 160) ||
        `Browse ${person.name}'s filmography on Nudge Film.`,
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

  const allCredits: PersonCredit[] = dedupeCredits(
    [
      ...(credits.cast ?? []).map((c) => ({ ...c, media_type: c.media_type ?? "movie" })),
      ...(credits.crew ?? []).map((c) => ({ ...c, media_type: c.media_type ?? "movie" })),
    ].filter((c) => c.media_type === "movie" || c.media_type === "tv"),
  );

  const knownFor = [...allCredits]
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 6);

  const profile = posterUrl(person.profile_path, "w500");
  const profileLarge = posterUrl(person.profile_path, "w1280");
  const birthDate = formatDate(person.birthday ?? null);
  const department = person.known_for_department || "Film";

  return (
    <article className="min-h-screen">
      {/* ── Cinematic backdrop blur behind the hero ── */}
      {profileLarge && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 opacity-[0.06]"
          style={{
            backgroundImage: `url(${profileLarge})`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            filter: "blur(40px) saturate(1.4)",
          }}
        />
      )}

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Back link */}
        <Link
          href="/browse"
          className="mb-8 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs text-zinc-400 transition hover:border-white/20 hover:text-zinc-200"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5">
            <path
              fillRule="evenodd"
              d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 1 1 1.06 1.06L4.81 7.25h7.44a.75.75 0 0 1 0 1.5H4.81l2.97 2.97a.75.75 0 0 1 0 1.06Z"
              clipRule="evenodd"
            />
          </svg>
          Browse
        </Link>

        {/* ── Hero ── */}
        <section className="mb-12 grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* Profile photo */}
          <div className="flex flex-col gap-4">
            <div className="relative aspect-[2/3] w-full max-w-[240px] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
              {profile ? (
                <TmdbImage
                  src={profile}
                  alt={person.name}
                  fill
                  className="object-cover"
                  sizes="240px"
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-600">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-16 opacity-30">
                    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Meta sidebar */}
            <div className="space-y-2 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  Known for
                </span>
                <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">
                  {department}
                </span>
              </div>
              {birthDate && (
                <p className="text-zinc-400">
                  <span className="text-zinc-500">Born</span> {birthDate}
                </p>
              )}
              {person.place_of_birth && (
                <p className="text-zinc-400">{person.place_of_birth}</p>
              )}
              <p className="text-zinc-500">
                {allCredits.length} credit{allCredits.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Bio + known-for */}
          <div className="flex flex-col gap-6">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500/75">
                {department}
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                {person.name}
              </h1>
            </div>

            {person.biography?.trim() ? (
              <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-zinc-300">
                {person.biography
                  .trim()
                  .split(/\n{2,}/)
                  .slice(0, 3)
                  .map((para, i) => (
                    <p key={i}>{para.trim()}</p>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No biography available.</p>
            )}

            {/* Known-for posters */}
            {knownFor.length > 0 && (
              <div>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  Known for
                </h2>
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
                  {knownFor.map((credit) => {
                    const title = credit.title || credit.name || "Untitled";
                    const poster = posterUrl(credit.poster_path, "w342");
                    const year = (credit.release_date || credit.first_air_date || "").slice(0, 4);
                    return (
                      <Link
                        key={`known-${credit.media_type}-${credit.id}`}
                        href={mediaHref(credit)}
                        prefetch={false}
                        className="group"
                      >
                        <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-zinc-900 transition duration-300 group-hover:border-indigo-400/40 group-hover:shadow-lg group-hover:shadow-indigo-900/20">
                          {poster ? (
                            <TmdbImage
                              src={poster}
                              alt={title}
                              fill
                              className="object-cover transition duration-500 group-hover:scale-[1.05]"
                              sizes="160px"
                            />
                          ) : null}
                          {credit.media_type === "tv" && (
                            <div className="absolute right-1 top-1 rounded bg-violet-600/80 px-1 py-0.5 text-[9px] font-bold text-white">
                              TV
                            </div>
                          )}
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-[11px] font-medium text-zinc-300 group-hover:text-white">
                          {title}
                        </p>
                        {year && <p className="text-[10px] text-zinc-600">{year}</p>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Filmography ── */}
        <div>
          <div className="mb-5 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">Filmography</h2>
            <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs text-zinc-400">
              {allCredits.length}
            </span>
          </div>
          <Suspense
            fallback={
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-2">
                    <div className="aspect-[2/3] animate-pulse rounded-lg bg-zinc-800" />
                    <div className="mt-2 h-3 animate-pulse rounded bg-zinc-800" />
                    <div className="mt-1.5 h-2 w-2/3 animate-pulse rounded bg-zinc-800" />
                  </div>
                ))}
              </div>
            }
          >
            <PersonFilmographyClient personId={personId} credits={allCredits} />
          </Suspense>
        </div>
      </div>
    </article>
  );
}
