"use client";

import { Avatar } from "@/components/ui/Avatar";
import Link from "next/link";
import { useMemo, useState } from "react";

type Connection = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type Props = {
  followers: Connection[];
  following: Connection[];
  initialTab?: "followers" | "following";
};

export function ProfileConnections({ followers, following, initialTab = "followers" }: Props) {
  const [tab, setTab] = useState<"followers" | "following">(initialTab);
  const [query, setQuery] = useState("");

  const source = tab === "followers" ? followers : following;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return source;
    return source.filter((p) => {
      const username = (p.username ?? "").toLowerCase();
      const name = (p.display_name ?? "").toLowerCase();
      const bio = (p.bio ?? "").toLowerCase();
      return username.includes(q) || name.includes(q) || bio.includes(q);
    });
  }, [query, source]);

  return (
    <section id="connections" className="mb-12 rounded-2xl border border-white/[0.08] bg-zinc-900/35 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Connections</h2>
        <div className="inline-flex rounded-xl border border-white/10 bg-black/20 p-1">
          <button
            type="button"
            onClick={() => setTab("followers")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              tab === "followers" ? "bg-indigo-500/20 text-indigo-200" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Followers ({followers.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("following")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              tab === "following" ? "bg-indigo-500/20 text-indigo-200" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Following ({following.length})
          </button>
        </div>
      </div>

      <div className="mb-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${tab}...`}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-indigo-400/30"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-zinc-400">
          No matches found.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => {
            const name = p.display_name?.trim() || p.username || "User";
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                <Link href={`/user/${p.username ?? p.id}`}>
                  <Avatar url={p.avatar_url} name={name} size={36} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/user/${p.username ?? p.id}`} className="block truncate text-sm font-medium text-white hover:text-indigo-300">
                    {name}
                  </Link>
                  {p.username ? <p className="text-xs text-zinc-500">@{p.username}</p> : null}
                  {p.bio ? <p className="line-clamp-1 text-xs text-zinc-500">{p.bio}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
