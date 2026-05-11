"use client";

import { getBlendRecommendations, type BlendActionResult } from "./blend-actions";
import { Avatar } from "@/components/ui/Avatar";
import TmdbImage from "@/components/ui/TmdbImage";
import { movieDetailPath } from "@/lib/media-slug";
import { posterUrl } from "@/lib/tmdb/constants";
import type { PublicProfile } from "@/features/users/service";
import type { RecommendedMovie } from "@/types/movie";
import Link from "next/link";
import { useState, useTransition } from "react";

// ─── Compact blend movie card ────────────────────────────────────────────────

function BlendMovieCard({ movie }: { movie: RecommendedMovie }) {
  const poster = posterUrl(movie.poster_path, "w342");
  const href = movieDetailPath(movie.title, movie.id);
  const primaryReason = movie.reasons[0];
  const secondReason = movie.reasons[1];

  return (
    <article className="group w-[120px] shrink-0 sm:w-[136px]">
      <Link
        href={href}
        className="relative block aspect-[2/3] overflow-hidden rounded-xl bg-zinc-800 ring-0 transition hover:ring-1 hover:ring-indigo-400/40"
        title={movie.title}
      >
        {poster ? (
          <TmdbImage
            src={poster}
            alt={movie.title}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.04]"
            sizes="136px"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-center text-[10px] leading-tight text-zinc-500">
            {movie.title}
          </div>
        )}
        {movie.vote_average > 0 ? (
          <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-200 ring-1 ring-white/10">
            ★ {movie.vote_average.toFixed(1)}
          </span>
        ) : null}
      </Link>

      <div className="mt-2 space-y-1 px-0.5">
        <Link
          href={href}
          className="block truncate text-xs font-medium leading-tight text-primary transition hover:text-indigo-400"
        >
          {movie.title}
        </Link>
        {movie.release_year ? (
          <p className="text-[10px] text-tertiary">{movie.release_year}</p>
        ) : null}
        {primaryReason ? (
          <p className="line-clamp-2 text-[10px] leading-tight text-indigo-400/80">
            {primaryReason.label}
          </p>
        ) : null}
        {secondReason && !primaryReason ? (
          <p className="line-clamp-2 text-[10px] leading-tight text-zinc-500">
            {secondReason.label}
          </p>
        ) : null}
      </div>
    </article>
  );
}

// ─── Friend selector card ─────────────────────────────────────────────────────

function FriendSelectorCard({
  profile,
  isSelected,
  isLoading,
  onClick,
}: {
  profile: PublicProfile;
  isSelected: boolean;
  isLoading: boolean;
  onClick: () => void;
}) {
  const name = profile.display_name?.trim() || profile.username || "User";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition disabled:opacity-60 ${
        isSelected
          ? "border-indigo-500/60 bg-indigo-500/10 text-indigo-300"
          : "border-[var(--surface-border)] bg-[var(--surface-2)] text-secondary hover:border-indigo-500/30 hover:text-primary"
      }`}
    >
      <Avatar url={profile.avatar_url} name={name} size={40} />
      <span className="max-w-[72px] truncate text-[11px] font-medium">{name}</span>
    </button>
  );
}

// ─── Results panel ────────────────────────────────────────────────────────────

function BlendResults({
  result,
  friend,
}: {
  result: BlendActionResult;
  friend: PublicProfile;
}) {
  const name = friend.display_name?.trim() || friend.username || "friend";

  if (!result.ok) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 px-6 py-8 text-center">
        <p className="text-sm text-zinc-400">{result.error}</p>
      </div>
    );
  }

  if (result.privacyBlocked) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 px-6 py-8 text-center">
        <p className="text-sm text-zinc-400">{name}&apos;s profile is private.</p>
        <p className="mt-1 text-xs text-zinc-600">
          Blend works with public profiles.
        </p>
      </div>
    );
  }

  if (result.insufficientData) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 px-6 py-8 text-center">
        <p className="text-sm text-zinc-400">Not enough diary data yet.</p>
        <p className="mt-1 text-xs text-zinc-600">
          Log more films to unlock Blend.
        </p>
      </div>
    );
  }

  if (result.movies.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 px-6 py-8 text-center">
        <p className="text-sm text-zinc-400">
          No strong overlap found between your tastes yet.
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          Log more films and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Taste summary */}
      <div className="flex flex-wrap items-center gap-2">
        <Avatar url={friend.avatar_url} name={name} size={28} />
        <span className="text-xs font-medium text-secondary">
          You &amp; {name} both enjoy
        </span>
        {result.sharedGenreNames.map((g) => (
          <span
            key={g}
            className="rounded-full border border-indigo-400/20 bg-indigo-400/8 px-2.5 py-0.5 text-[11px] text-indigo-300"
          >
            {g}
          </span>
        ))}
      </div>

      {/* Movie carousel */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {result.movies.map((movie) => (
            <BlendMovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function BlendLoadingSkeleton() {
  return (
    <div className="mt-4 space-y-4">
      <div className="flex gap-2">
        {[48, 64, 80].map((w) => (
          <div
            key={w}
            className="h-5 animate-pulse rounded-full bg-zinc-800"
            style={{ width: w }}
          />
        ))}
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-[120px] shrink-0 sm:w-[136px]">
            <div className="aspect-[2/3] animate-pulse rounded-xl bg-zinc-800" />
            <div className="mt-2 space-y-1.5">
              <div className="h-3 w-20 animate-pulse rounded bg-zinc-800" />
              <div className="h-2.5 w-14 animate-pulse rounded bg-zinc-800/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

export function BlendSection({ following }: { following: PublicProfile[] }) {
  const [selectedFriend, setSelectedFriend] = useState<PublicProfile | null>(null);
  const [blendResult, setBlendResult] = useState<BlendActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSelectFriend(friend: PublicProfile) {
    if (isPending) return;
    setSelectedFriend(friend);
    setBlendResult(null);
    startTransition(async () => {
      const result = await getBlendRecommendations(friend.id);
      setBlendResult(result);
    });
  }

  if (following.length === 0) {
    return (
      <section className="mb-10">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-primary">Blend with a Friend</h2>
          <p className="mt-0.5 text-xs text-tertiary">
            Discover movies you&apos;d both enjoy.
          </p>
        </div>
        <div className="surface-card-subtle rounded-2xl border border-dashed px-6 py-10 text-center">
          <p className="text-sm text-secondary">Follow someone to use Blend.</p>
          <p className="mt-1 text-xs text-tertiary">
            Search for friends above and follow them.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-10">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-primary">
          Blend with a Friend
        </h2>
        <p className="mt-0.5 text-xs text-tertiary">
          Pick someone you follow — we&apos;ll find films you&apos;d both enjoy.
        </p>
      </div>

      {/* Friend selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {following.map((friend) => {
          const isSelected = selectedFriend?.id === friend.id;
          return (
            <FriendSelectorCard
              key={friend.id}
              profile={friend}
              isSelected={isSelected}
              isLoading={isPending && isSelected}
              onClick={() => handleSelectFriend(friend)}
            />
          );
        })}
      </div>

      {/* Loading state */}
      {isPending && <BlendLoadingSkeleton />}

      {/* Results */}
      {!isPending && blendResult && selectedFriend ? (
        <BlendResults result={blendResult} friend={selectedFriend} />
      ) : null}

      {/* Idle prompt */}
      {!isPending && !blendResult && (
        <p className="mt-3 text-xs text-tertiary">
          ↑ Select a friend to generate your Blend.
        </p>
      )}
    </section>
  );
}
