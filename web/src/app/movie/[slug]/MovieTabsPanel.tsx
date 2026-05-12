"use client";

import { TMDB_IMAGE_BASE } from "@/lib/tmdb/constants";
import TmdbImage from "@/components/ui/TmdbImage";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const MOVIE_TABS = ["cast", "crew", "details", "genres", "availability"] as const;
type MovieTab = (typeof MOVIE_TABS)[number];

function isMovieTab(v: string | null): v is MovieTab {
  return !!v && (MOVIE_TABS as readonly string[]).includes(v);
}

type CastMember = { id: number; name: string; character?: string };
type CrewMember = { id: number; name: string; job: string };
type Genre = { id: number; name: string };
type Provider = { provider_id: number; provider_name: string; logo_path: string | null };
type ProviderRegion = {
  link?: string;
  flatrate?: Provider[];
  rent?: Provider[];
  buy?: Provider[];
} | null;

type Props = {
  slug: string;
  cast: CastMember[];
  directors: CrewMember[];
  writers: CrewMember[];
  producers: CrewMember[];
  genres: Genre[];
  runtime: number | null | undefined;
  spokenLanguages: string;
  releaseDate: string;
  countries: string;
  companies: string;
  statusLine: string;
  providerRegion: ProviderRegion;
  externalIdLinks: { tmdb: string; imdb: string | null; homepage: string | null };
};

export function MovieTabsPanel({
  slug,
  cast,
  directors,
  writers,
  producers,
  genres,
  runtime,
  spokenLanguages,
  releaseDate,
  countries,
  companies,
  statusLine,
  providerRegion,
  externalIdLinks,
}: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams.get("tab");
  const activeTab: MovieTab = isMovieTab(rawTab) ? rawTab : "cast";

  function tabHref(tab: MovieTab) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("tab", tab);
    return `/movie/${slug}?${sp.toString()}`;
  }

  return (
    <section className="mt-8 sm:mt-10">
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto border-b border-white/10 px-1 pt-1 pb-3">
        {MOVIE_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => router.replace(tabHref(tab), { scroll: false })}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium capitalize transition ${
              activeTab === tab
                ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/30"
                : "bg-white/5 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "cast" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {cast.slice(0, 36).map((member) => (
            <Link
              key={`${member.id}-${member.character ?? ""}`}
              href={`/person/${member.id}`}
              prefetch={false}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-zinc-200 transition hover:border-indigo-400/30"
            >
              <span className="font-medium">{member.name}</span>
              {member.character ? <span className="ml-1 text-zinc-400">as {member.character}</span> : null}
            </Link>
          ))}
        </div>
      ) : null}

      {activeTab === "crew" ? (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Directors</p>
            <div className="space-y-2">
              {directors.length > 0 ? directors.map((d) => (
                <Link key={`director-${d.id}`} href={`/person/${d.id}`} prefetch={false} className="block text-sm text-zinc-200 hover:text-indigo-300">{d.name}</Link>
              )) : <p className="text-sm text-zinc-500">No data</p>}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Writers</p>
            <div className="space-y-2">
              {writers.slice(0, 12).length > 0 ? writers.slice(0, 12).map((w) => (
                <p key={`writer-${w.id}-${w.job}`} className="text-sm text-zinc-200">{w.name} <span className="text-zinc-500">({w.job})</span></p>
              )) : <p className="text-sm text-zinc-500">No data</p>}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Producers</p>
            <div className="space-y-2">
              {producers.slice(0, 12).length > 0 ? producers.slice(0, 12).map((p) => (
                <p key={`producer-${p.id}-${p.job}`} className="text-sm text-zinc-200">{p.name}</p>
              )) : <p className="text-sm text-zinc-500">No data</p>}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "details" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">Runtime: {runtime ?? "—"} min</div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">Language: {spokenLanguages || "—"}</div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">Release: {releaseDate || "—"}</div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">Countries: {countries || "—"}</div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">Companies: {companies || "—"}</div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">{statusLine}</div>
        </div>
      ) : null}

      {activeTab === "genres" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {genres.map((g) => (
            <Link key={g.id} href={`/recommend?genres=${g.id}`} prefetch={false} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-zinc-200 hover:border-indigo-400/30">
              {g.name}
            </Link>
          ))}
        </div>
      ) : null}

      {activeTab === "availability" ? (
        <div className="mt-4 space-y-4">
          {providerRegion ? (
            <>
              {(["flatrate", "rent", "buy"] as const).map((k) => (
                <div key={k} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="mb-3 text-xs uppercase tracking-wide text-zinc-500">
                    {k === "flatrate" ? "Stream" : k === "rent" ? "Rent" : "Buy"}
                  </p>
                  {(providerRegion[k] ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {providerRegion[k]?.map((p) => (
                        <a
                          key={`${k}-${p.provider_id}`}
                          href={providerRegion.link || externalIdLinks.tmdb}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-sm text-zinc-200 hover:border-indigo-400/30"
                        >
                          {p.logo_path ? (
                            <TmdbImage src={`${TMDB_IMAGE_BASE}/w92${p.logo_path}`} alt="" width={20} height={20} className="rounded" />
                          ) : null}
                          {p.provider_name}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">No options listed.</p>
                  )}
                </div>
              ))}
            </>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">
              No streaming options found for your region.
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
