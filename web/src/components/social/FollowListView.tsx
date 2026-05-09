"use client";

import { Avatar } from "@/components/ui/Avatar";
import Link from "next/link";
import { useMemo, useState } from "react";

export type FollowListEntry = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio?: string | null;
};

type Props = {
  title: string;
  backHref: string;
  backLabel: string;
  profiles: FollowListEntry[];
  searchPlaceholder: string;
};

export function FollowListView({
  title,
  backHref,
  backLabel,
  profiles,
  searchPlaceholder,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => {
      const username = (p.username ?? "").toLowerCase();
      const name = (p.display_name ?? "").toLowerCase();
      const bio = (p.bio ?? "").toLowerCase();
      return username.includes(q) || name.includes(q) || bio.includes(q);
    });
  }, [query, profiles]);

  return (
    <div className="relative isolate min-h-screen bg-zinc-950">
      <div className="mx-auto w-full max-w-lg px-4 py-6 sm:px-6">
        <Link
          href={backHref}
          className="mb-6 inline-flex text-sm text-zinc-400 transition hover:text-white"
        >
          ← {backLabel}
        </Link>

        <h1 className="mb-4 text-xl font-semibold text-white">{title}</h1>

        <div className="mb-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-indigo-400/30"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 bg-zinc-900/35 px-4 py-10 text-center text-sm text-zinc-400">
            No matches found.
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((p) => {
              const name = p.display_name?.trim() || p.username || "User";
              const profileHref = p.username ? `/user/${p.username}` : "#";
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/40 px-3 py-2.5"
                >
                  {p.username ? (
                    <Link href={profileHref}>
                      <Avatar url={p.avatar_url} name={name} size={36} />
                    </Link>
                  ) : (
                    <Avatar url={p.avatar_url} name={name} size={36} />
                  )}
                  <div className="min-w-0 flex-1">
                    {p.username ? (
                      <Link
                        href={profileHref}
                        className="block truncate text-sm font-medium text-white hover:text-indigo-300"
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="block truncate text-sm font-medium text-white">{name}</span>
                    )}
                    {p.username ? (
                      <p className="text-xs text-zinc-500">@{p.username}</p>
                    ) : null}
                    {p.bio ? (
                      <p className="line-clamp-1 text-xs text-zinc-500">{p.bio}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
