"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Link2, Users, Sparkles, LogOut, X, RefreshCw } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import TmdbImage from "@/components/ui/TmdbImage";
import { movieDetailPath } from "@/lib/media-slug";
import { posterUrl } from "@/lib/tmdb/constants";
import {
  joinBlendParty,
  leaveBlendParty,
  closeBlendParty,
  generatePartyRecommendations,
  type BlendPartyData,
  type GenerateResult,
} from "@/app/blend/actions";
import type { RecommendedMovie } from "@/types/movie";
import Link from "next/link";
import { addToWatchlist, markWatched } from "@/app/actions/library";

// ─── Sub-components ───────────────────────────────────────────────────────────

function MemberAvatarStack({ members }: { members: BlendPartyData["members"] }) {
  return (
    <div className="flex -space-x-2">
      {members.map((m) => {
        const name = m.display_name?.trim() || m.username || "User";
        return (
          <div key={m.user_id} title={name}>
            <Avatar url={m.avatar_url} name={name} size={36} className="ring-2 ring-[var(--bg-base)]" />
          </div>
        );
      })}
    </div>
  );
}

function MemberList({
  members,
  currentUserId,
}: {
  members: BlendPartyData["members"];
  currentUserId: string;
}) {
  return (
    <ul className="space-y-2">
      {members.map((m) => {
        const name = m.display_name?.trim() || m.username || "User";
        const isYou = m.user_id === currentUserId;
        return (
          <li
            key={m.user_id}
            className="flex items-center gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)] px-3 py-2.5"
          >
            <Avatar url={m.avatar_url} name={name} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-primary">
                {name} {isYou && <span className="text-xs text-tertiary">(you)</span>}
              </p>
              {m.username ? (
                <p className="text-xs text-tertiary">@{m.username}</p>
              ) : null}
            </div>
            {m.role === "creator" && (
              <span className="rounded-full border border-indigo-400/20 bg-indigo-400/8 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                host
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ─── Movie result card ────────────────────────────────────────────────────────

function PartyMovieCard({
  movie,
  memberCount,
}: {
  movie: RecommendedMovie;
  memberCount: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [queued, setQueued] = useState(false);
  const [logged, setLogged] = useState(false);
  const poster = posterUrl(movie.poster_path, "w342");
  const href = movieDetailPath(movie.title, movie.id);
  const primaryReason = movie.reasons[0];

  function handleWatchlist() {
    startTransition(async () => {
      try {
        setQueued(true);
        await addToWatchlist(movie.id);
        toast.success(`${movie.title} added to watchlist.`);
      } catch {
        setQueued(false);
        toast.error("Couldn't add to watchlist.");
      }
    });
  }

  function handleLog() {
    startTransition(async () => {
      try {
        setLogged(true);
        await markWatched(movie.id, null, null);
        toast.success(`${movie.title} logged.`);
      } catch {
        setLogged(false);
        toast.error("Couldn't log film.");
      }
    });
  }

  return (
    <article className="group flex gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-2)] p-3 transition hover:border-indigo-400/20">
      {/* Poster */}
      <Link
        href={href}
        className="relative block h-[108px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-zinc-800 transition hover:ring-1 hover:ring-indigo-400/30"
      >
        {poster ? (
          <TmdbImage
            src={poster}
            alt={movie.title}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
            sizes="72px"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-1 text-center text-[9px] text-zinc-500">
            {movie.title}
          </div>
        )}
      </Link>

      {/* Details */}
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-start justify-between gap-2">
          <Link href={href} className="block min-w-0">
            <h3 className="truncate text-sm font-semibold text-primary transition hover:text-indigo-400 leading-tight">
              {movie.title}
            </h3>
          </Link>
          {movie.vote_average > 0 && (
            <span className="shrink-0 rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-200">
              ★ {movie.vote_average.toFixed(1)}
            </span>
          )}
        </div>

        {movie.release_year ? (
          <p className="mt-0.5 text-xs text-tertiary">{movie.release_year}</p>
        ) : null}

        {primaryReason ? (
          <p className="mt-1.5 line-clamp-2 text-[11px] leading-tight text-indigo-400/80">
            {primaryReason.label}
          </p>
        ) : null}

        {/* Actions */}
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            disabled={isPending || queued}
            onClick={handleWatchlist}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
              queued
                ? "border-indigo-400/30 bg-indigo-400/10 text-indigo-300"
                : "border-[var(--surface-border)] text-secondary hover:border-indigo-400/30 hover:text-indigo-300"
            } disabled:opacity-50`}
          >
            {queued ? "Saved" : "Watchlist"}
          </button>
          <button
            type="button"
            disabled={isPending || logged}
            onClick={handleLog}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
              logged
                ? "border-indigo-400/30 bg-indigo-400/10 text-indigo-300"
                : "border-[var(--surface-border)] text-secondary hover:border-indigo-400/30 hover:text-indigo-300"
            } disabled:opacity-50`}
          >
            {logged ? "Logged" : "Mark watched"}
          </button>
          <Link
            href={href}
            className="rounded-lg border border-[var(--surface-border)] px-2.5 py-1 text-[11px] font-medium text-secondary transition hover:border-indigo-400/30 hover:text-indigo-300"
          >
            Details
          </Link>
        </div>
      </div>
    </article>
  );
}

// ─── Results panel ────────────────────────────────────────────────────────────

function ResultsPanel({
  result,
  memberCount,
  sharedGenreNames,
  inviteUrl,
  onRegenerate,
  isRegenerating,
}: {
  result: { movies: RecommendedMovie[] };
  memberCount: number;
  sharedGenreNames: string[];
  inviteUrl: string;
  onRegenerate: () => void;
  isRegenerating: boolean;
}) {
  async function shareResults() {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Blend Party Picks", url: inviteUrl });
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        toast.success("Results link copied.");
      }
    } catch {
      toast.error("Couldn't copy link.");
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Genre summary */}
      {sharedGenreNames.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-secondary">Group vibes:</span>
          {sharedGenreNames.map((g) => (
            <span
              key={g}
              className="rounded-full border border-indigo-400/20 bg-indigo-400/8 px-2.5 py-0.5 text-[11px] text-indigo-300"
            >
              {g}
            </span>
          ))}
        </div>
      )}

      {/* Movie list */}
      <div className="space-y-3">
        {result.movies.map((movie) => (
          <PartyMovieCard key={movie.id} movie={movie} memberCount={memberCount} />
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="flex items-center gap-1.5 rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs font-medium text-secondary transition hover:border-indigo-400/30 hover:text-indigo-300 disabled:opacity-50"
        >
          <RefreshCw className="size-3.5" />
          Regenerate
        </button>
        <button
          type="button"
          onClick={shareResults}
          className="flex items-center gap-1.5 rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs font-medium text-secondary transition hover:border-indigo-400/30 hover:text-indigo-300"
        >
          <Link2 className="size-3.5" />
          Share results
        </button>
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ResultsSkeleton() {
  return (
    <div className="mt-6 space-y-3">
      <div className="flex gap-2">
        {[60, 80, 70].map((w, i) => (
          <div key={i} className="h-5 animate-pulse rounded-full bg-zinc-800" style={{ width: w }} />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 rounded-2xl border border-[var(--surface-border)] p-3">
          <div className="h-[108px] w-[72px] animate-pulse rounded-xl bg-zinc-800 shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3.5 w-3/4 animate-pulse rounded bg-zinc-800" />
            <div className="h-2.5 w-1/4 animate-pulse rounded bg-zinc-800/60" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-zinc-800/40 mt-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  party: BlendPartyData;
  currentUserId: string;
  isMember: boolean;
  isCreator: boolean;
  inviteUrl: string;
};

export function BlendPartyClient({
  party: initialParty,
  currentUserId,
  isMember: initialIsMember,
  isCreator,
  inviteUrl,
}: Props) {
  const router = useRouter();
  const [party, setParty] = useState(initialParty);
  const [isMember, setIsMember] = useState(initialIsMember);
  const [isPending, startTransition] = useTransition();
  const [genResult, setGenResult] = useState<GenerateResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showClose, setShowClose] = useState(false);

  const partyName =
    party.title ??
    (() => {
      const creator = party.members.find((m) => m.role === "creator");
      const name = creator?.display_name?.trim() || creator?.username || "Someone";
      return `${name}'s Blend Party`;
    })();

  const spotsLeft = party.max_participants - party.members.length;
  const canGenerate = party.members.length >= 2 && party.status === "active";

  // ── Copy invite link ──────────────────────────────────────────────────────

  async function copyInviteLink() {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: partyName,
          text: "Join my Blend Party — find movies we all might enjoy!",
          url: inviteUrl,
        });
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        toast.success("Invite link copied.");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        toast.success("Invite link copied.");
      } catch {
        toast.error("Couldn't copy link.");
      }
    }
  }

  // ── Join ──────────────────────────────────────────────────────────────────

  function handleJoin() {
    startTransition(async () => {
      const result = await joinBlendParty(party.token);
      if (result.ok) {
        toast.success("You joined the Blend Party!");
        setIsMember(true);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  // ── Leave ─────────────────────────────────────────────────────────────────

  function handleLeave() {
    startTransition(async () => {
      const result = await leaveBlendParty(party.id);
      if (result.ok) {
        toast.success("You left the party.");
        router.push("/friends");
      } else {
        toast.error(result.error ?? "Couldn't leave.");
      }
    });
  }

  // ── Close ─────────────────────────────────────────────────────────────────

  function handleClose() {
    startTransition(async () => {
      const result = await closeBlendParty(party.id);
      if (result.ok) {
        toast.success("Party closed.");
        router.push("/friends");
      } else {
        toast.error(result.error ?? "Couldn't close.");
      }
    });
  }

  // ── Generate ──────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setGenResult(null);
    try {
      const result = await generatePartyRecommendations(party.id);
      setGenResult(result);
      if (!result.ok) {
        toast.error(result.error);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [party.id]);

  const isExpired =
    party.status === "expired" || new Date(party.expires_at) < new Date();

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      {/* Header */}
      <header className="mb-8 space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-500/75">
          Blend Party
        </p>
        <h1 className="text-2xl font-semibold text-primary">{partyName}</h1>
        {isExpired && (
          <p className="text-xs text-amber-400">This party has ended.</p>
        )}
      </header>

      {/* Participant count + spots */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <MemberAvatarStack members={party.members} />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-primary">
            {party.members.length} of {party.max_participants} joined
          </span>
          {spotsLeft > 0 && !isExpired && (
            <span className="text-xs text-tertiary">
              {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
            </span>
          )}
        </div>

        {/* Join / Leave CTAs */}
        {!isExpired && (
          <div className="ml-auto flex gap-2">
            {!isMember && (
              <button
                type="button"
                onClick={handleJoin}
                disabled={isPending || spotsLeft === 0}
                className="rounded-full bg-indigo-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 hover:-translate-y-0.5 disabled:opacity-50"
              >
                {isPending ? "Joining…" : spotsLeft === 0 ? "Full" : "Join Party"}
              </button>
            )}
            {isMember && !isCreator && (
              <button
                type="button"
                onClick={handleLeave}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs font-medium text-secondary transition hover:border-red-400/30 hover:text-red-400 disabled:opacity-50"
              >
                <LogOut className="size-3.5" />
                Leave
              </button>
            )}
          </div>
        )}
      </div>

      {/* Invite link */}
      {isMember && !isExpired && (
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-2)] p-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-secondary mb-0.5">Invite link</p>
            <p className="truncate text-xs text-tertiary font-mono">{inviteUrl}</p>
          </div>
          <button
            type="button"
            onClick={copyInviteLink}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-3)] px-3 py-2 text-xs font-medium text-secondary transition hover:border-indigo-400/30 hover:text-indigo-300"
          >
            <Copy className="size-3.5" />
            Copy
          </button>
        </div>
      )}

      {/* Member list */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <Users className="size-4 text-indigo-400/60" />
          <h2 className="text-sm font-semibold text-primary">Participants</h2>
        </div>
        <MemberList members={party.members} currentUserId={currentUserId} />

        {spotsLeft > 0 && isMember && !isExpired && (
          <div className="mt-2 flex items-center justify-center rounded-xl border border-dashed border-[var(--surface-border)] py-4">
            <button
              type="button"
              onClick={copyInviteLink}
              className="flex items-center gap-2 text-xs text-tertiary transition hover:text-indigo-400"
            >
              <Link2 className="size-3.5" />
              Invite {spotsLeft} more {spotsLeft === 1 ? "person" : "people"} →
            </button>
          </div>
        )}
      </section>

      {/* Generate section */}
      {isMember && !isExpired && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-primary">Group Picks</h2>
            {genResult?.ok && (
              <span className="text-xs text-tertiary">{genResult.movies.length} films</span>
            )}
          </div>

          {party.members.length < 2 ? (
            <div className="surface-card-subtle rounded-2xl border border-dashed px-6 py-10 text-center">
              <p className="text-sm text-secondary">You need at least 2 people to generate picks.</p>
              <p className="mt-1 text-xs text-tertiary">
                Invite a friend using the link above.
              </p>
            </div>
          ) : !genResult ? (
            <div className="text-center py-6">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="group inline-flex items-center gap-2.5 rounded-full bg-indigo-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 hover:-translate-y-0.5 hover:shadow-indigo-400/30 disabled:opacity-60"
              >
                <Sparkles className="size-4 transition group-hover:scale-110" />
                {isGenerating ? "Blending tastes…" : "Generate Picks"}
              </button>
              <p className="mt-3 text-xs text-tertiary">
                Based on everyone&apos;s watch history and ratings.
              </p>
            </div>
          ) : null}

          {isGenerating && <ResultsSkeleton />}

          {genResult?.ok && !isGenerating && (
            <ResultsPanel
              result={genResult}
              memberCount={party.members.length}
              sharedGenreNames={genResult.groupProfile?.sharedGenreNames ?? []}
              inviteUrl={inviteUrl}
              onRegenerate={handleGenerate}
              isRegenerating={isGenerating}
            />
          )}

          {genResult && !genResult.ok && !isGenerating && (
            <div className="rounded-2xl border border-dashed border-white/10 px-6 py-8 text-center">
              <p className="text-sm text-secondary">{genResult.error}</p>
              <button
                type="button"
                onClick={handleGenerate}
                className="mt-4 text-xs text-indigo-400 hover:text-indigo-300 transition"
              >
                Try again
              </button>
            </div>
          )}
        </section>
      )}

      {/* Creator controls */}
      {isCreator && !isExpired && (
        <section className="border-t border-[var(--surface-border)] pt-6">
          {!showClose ? (
            <button
              type="button"
              onClick={() => setShowClose(true)}
              className="flex items-center gap-1.5 text-xs text-tertiary transition hover:text-red-400"
            >
              <X className="size-3.5" />
              Close party
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-xs text-secondary">Close party for everyone?</p>
              <button
                type="button"
                onClick={handleClose}
                disabled={isPending}
                className="rounded-lg border border-red-400/30 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-400/10 disabled:opacity-50"
              >
                {isPending ? "Closing…" : "Yes, close it"}
              </button>
              <button
                type="button"
                onClick={() => setShowClose(false)}
                className="text-xs text-tertiary transition hover:text-secondary"
              >
                Cancel
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
