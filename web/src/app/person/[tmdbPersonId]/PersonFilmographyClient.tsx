"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import TmdbImage from "@/components/ui/TmdbImage";
import { browseMediaPath } from "@/lib/media-slug";
import { posterUrl } from "@/lib/tmdb/constants";
import type { PersonCredit } from "@/lib/tmdb/client";
import Link from "next/link";

const ROLE_OPTIONS = ["all", "acting", "directing", "writing", "production"] as const;
type RoleOption = (typeof ROLE_OPTIONS)[number];

const SORT_OPTIONS = ["popularity", "release_date", "rating"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

function mediaHref(credit: PersonCredit): string {
  const label = credit.title ?? credit.name ?? "Unknown";
  return browseMediaPath(label, credit.id, credit.media_type);
}

function releaseLabel(credit: PersonCredit): string {
  const date = credit.release_date || credit.first_air_date || "";
  return date ? date.slice(0, 4) : "—";
}

function normalizeRole(value: string | null): RoleOption {
  return (ROLE_OPTIONS as readonly string[]).includes(value ?? "") ? (value as RoleOption) : "all";
}

function normalizeSort(value: string | null): SortOption {
  return (SORT_OPTIONS as readonly string[]).includes(value ?? "") ? (value as SortOption) : "popularity";
}

export function PersonFilmographyClient({
  personId,
  credits,
}: {
  personId: number;
  credits: PersonCredit[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const role = normalizeRole(searchParams.get("role"));
  const sort = normalizeSort(searchParams.get("sort"));

  const setFilter = useCallback(
    (newRole: RoleOption, newSort: SortOption) => {
      const sp = new URLSearchParams();
      sp.set("role", newRole);
      sp.set("sort", newSort);
      router.replace(`/person/${personId}?${sp.toString()}`, { scroll: false });
    },
    [router, personId],
  );

  const filtered = credits.filter((credit) => {
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

  return (
    <section className="mt-10">
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          {ROLE_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setFilter(r, sort)}
              className={`min-h-10 rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition ${
                role === r
                  ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/30"
                  : "bg-white/5 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Sort</span>
          {SORT_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(role, s)}
              className={`min-h-10 rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition ${
                sort === s
                  ? "bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/30"
                  : "bg-white/5 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {sorted.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {sorted.map((credit, i) => {
            const title = credit.title || credit.name || "Untitled";
            const poster = posterUrl(credit.poster_path, "w342");
            return (
              <Link
                key={`${credit.media_type}-${credit.id}-${title}-${i}`}
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
                      sizes="220px"
                    />
                  ) : null}
                </div>
                <p className="mt-2 line-clamp-2 text-xs font-medium text-zinc-200">{title}</p>
                <p className="text-[11px] text-zinc-500">
                  {releaseLabel(credit)} · ★ {credit.vote_average?.toFixed(1) ?? "—"}
                </p>
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
  );
}
