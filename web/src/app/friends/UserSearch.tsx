"use client";

import { FollowButton } from "@/components/social/FollowButton";
import { Avatar } from "@/components/ui/Avatar";
import type { FollowStatus } from "@/features/users/service";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Hit = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  followStatus: FollowStatus;
};

export function UserSearch() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 320);
    return () => clearTimeout(t);
  }, [query]);

  const runSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
        credentials: "same-origin",
      });
      const data = (await res.json()) as { results?: Hit[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setResults(data.results ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runSearch(debounced);
  }, [debounced, runSearch]);

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by username…"
        autoComplete="off"
        className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:ring-2 focus:ring-indigo-400/25"
      />
      {error ? <p className="text-xs text-red-300/80">{error}</p> : null}
      {loading ? <p className="text-xs text-zinc-500">Searching…</p> : null}
      {results.length > 0 ? (
        <ul className="space-y-2">
          {results.map((u) => {
            const name = u.display_name?.trim() || u.username || "User";
            return (
              <li
                key={u.id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/40 p-3"
              >
                <Link href={`/user/${u.username ?? u.id}`}>
                  <Avatar url={u.avatar_url} name={name} size={40} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/user/${u.username ?? u.id}`}
                    className="block truncate text-sm font-medium text-white hover:text-indigo-200"
                  >
                    {name}
                  </Link>
                  {u.username ? (
                    <p className="text-xs text-zinc-500">@{u.username}</p>
                  ) : null}
                  {u.bio ? (
                    <p className="line-clamp-1 text-xs text-zinc-500">{u.bio}</p>
                  ) : null}
                </div>
                <FollowButton targetId={u.id} initialFollowing={u.followStatus === "following"} />
              </li>
            );
          })}
        </ul>
      ) : debounced.length >= 2 && !loading ? (
        <p className="text-xs text-zinc-500">No users found.</p>
      ) : null}
    </div>
  );
}
