import { getPersonCombinedCredits, getPersonDetails, type PersonCredit } from "@/lib/tmdb/client";
import { posterUrl } from "@/lib/tmdb/constants";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ tmdbPersonId: string }>;
  searchParams: Promise<{ role?: string; sort?: string }>;
};

const ROLE_OPTIONS = ["all", "acting", "directing", "writing", "production"] as const;
type RoleOption = (typeof ROLE_OPTIONS)[number];

const SORT_OPTIONS = ["popularity", "release_date", "rating"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

function mediaHref(credit: PersonCredit): string {
  return credit.media_type === "tv" ? `/show/${credit.id}` : `/movie/${credit.id}`;
}

function releaseLabel(credit: PersonCredit): string {
  const date = credit.release_date || credit.first_air_date || "";
  return date ? date.slice(0, 4) : "—";
}

function normalizeRole(value: string | undefined): RoleOption {
  return (ROLE_OPTIONS as readonly string[]).includes(value ?? "") ? (value as RoleOption) : "all";
}

function normalizeSort(value: string | undefined): SortOption {
  return (SORT_OPTIONS as readonly string[]).includes(value ?? "") ? (value as SortOption) : "popularity";
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
    // Keep whichever entry has better signal for ranking/display.
    const existingScore = (existing.popularity ?? 0) + (existing.vote_average ?? 0);
    const nextScore = (credit.popularity ?? 0) + (credit.vote_average ?? 0);
    if (nextScore > existingScore) byKey.set(key, credit);
  }
  return [...byKey.values()];
}

export default async function PersonPage({ params, searchParams }: Props) {
  const { tmdbPersonId: rawId } = await params;
  const { role: roleParam, sort: sortParam } = await searchParams;
  const personId = Number(rawId);
  if (!Number.isFinite(personId)) notFound();

  const role = normalizeRole(roleParam);
  const sort = normalizeSort(sortParam);

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

  const filtered = allCredits.filter((credit) => {
    if (role === "all") return true;
    if (role === "acting") return !!credit.character;
    const dept = String(credit.department ?? "").toLowerCase();
    if (role === "directing") return dept.includes("direct");
    if (role === "writing") return dept.includes("writing") || dept.includes("writer");
    if (role === "production") return dept.includes("production");
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "rating") return (b.vote_average ?? 0) - (a.vote_average ?? 0);
    if (sort === "release_date") {
      const ad = new Date(a.release_date || a.first_air_date || "1970-01-01").getTime();
      const bd = new Date(b.release_date || b.first_air_date || "1970-01-01").getTime();
      return bd - ad;
    }
    return (b.popularity ?? 0) - (a.popularity ?? 0);
  });

  const knownFor = [...allCredits]
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 8);

  const profile = posterUrl(person.profile_path, "w500");

  return (
    <article className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/browse" className="mb-4 inline-flex min-h-10 items-center rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
        ← Back
      </Link>

      <section className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900">
            {profile ? <Image src={profile} alt={person.name} fill className="object-cover" sizes="280px" /> : null}
          </div>
          <div className="mt-3 space-y-1 text-sm text-zinc-300">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{person.known_for_department || "Film"}</p>
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
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">Known for</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {knownFor.map((credit) => {
                const title = credit.title || credit.name || "Untitled";
                const poster = posterUrl(credit.poster_path, "w342");
                return (
                  <Link key={`known-${credit.media_type}-${credit.id}-${title}`} href={mediaHref(credit)} className="group rounded-xl border border-white/10 bg-black/20 p-2">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900">
                      {poster ? <Image src={poster} alt={title} fill className="object-cover transition group-hover:scale-[1.03]" sizes="200px" /> : null}
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-zinc-200">{title}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            {ROLE_OPTIONS.map((r) => (
              <Link
                key={r}
                href={`/person/${personId}?role=${r}&sort=${sort}`}
                className={`min-h-10 rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition ${
                  role === r ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/30" : "bg-white/5 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {r}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <span className="mr-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Sort</span>
            {SORT_OPTIONS.map((s) => (
              <Link
                key={s}
                href={`/person/${personId}?role=${role}&sort=${s}`}
                className={`min-h-10 rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition ${
                  sort === s ? "bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/30" : "bg-white/5 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {s.replace("_", " ")}
              </Link>
            ))}
          </div>
        </div>

        {sorted.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {sorted.map((credit, i) => {
              const title = credit.title || credit.name || "Untitled";
              const poster = posterUrl(credit.poster_path, "w342");
              return (
                <Link key={`${credit.media_type}-${credit.id}-${title}-${i}`} href={mediaHref(credit)} className="group rounded-xl border border-white/10 bg-black/20 p-2">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900">
                    {poster ? <Image src={poster} alt={title} fill className="object-cover transition group-hover:scale-[1.03]" sizes="220px" /> : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs font-medium text-zinc-200">{title}</p>
                  <p className="text-[11px] text-zinc-500">{releaseLabel(credit)} · ★ {credit.vote_average?.toFixed(1) ?? "—"}</p>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">
            No credits found for this filter.
          </p>
        )}
      </section>
    </article>
  );
}
