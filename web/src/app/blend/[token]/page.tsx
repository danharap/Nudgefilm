import { createClient } from "@/lib/supabase/server";
import { getPartyByToken } from "@/app/blend/actions";
import { getConfiguredOrigin } from "@/lib/site-url";
import { BlendPartyClient } from "./BlendPartyClient";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const result = await getPartyByToken(token);
  const title = result.ok && result.party.title
    ? `${result.party.title} — Blend Party`
    : "Blend Party";
  return {
    title: `${title} · Nudge Film`,
    description: "Join the Blend Party and find movies everyone might enjoy.",
  };
}

export default async function BlendPartyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const partyResult = await getPartyByToken(token);

  // Invite URL for sharing
  const origin = getConfiguredOrigin();
  const inviteUrl = `${origin}/blend/${token}`;

  // ── Invalid / not found ──────────────────────────────────────────────────
  if (!partyResult.ok) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <p className="text-4xl mb-4">🎬</p>
        <h1 className="text-xl font-semibold text-primary mb-2">Party not found</h1>
        <p className="text-sm text-secondary mb-8">
          This invite link is invalid or the party no longer exists.
        </p>
        <Link
          href="/friends"
          className="rounded-full bg-indigo-500/15 px-6 py-2.5 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/25"
        >
          Back to Social
        </Link>
      </div>
    );
  }

  const party = partyResult.party;

  // ── Expired ──────────────────────────────────────────────────────────────
  if (
    party.status === "expired" ||
    new Date(party.expires_at) < new Date()
  ) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <p className="text-4xl mb-4">⏳</p>
        <h1 className="text-xl font-semibold text-primary mb-2">This party has ended</h1>
        <p className="text-sm text-secondary mb-8">
          Blend Party links expire after 48 hours.
        </p>
        <Link
          href="/friends"
          className="rounded-full bg-indigo-500/15 px-6 py-2.5 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/25"
        >
          Create a new party
        </Link>
      </div>
    );
  }

  // ── Logged out — show preview + sign-in prompt ───────────────────────────
  if (!user) {
    const creatorMember = party.members.find((m) => m.role === "creator");
    const creatorName =
      creatorMember?.display_name?.trim() ||
      creatorMember?.username ||
      "Someone";

    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mb-8 space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-500/75">
            Blend Party
          </p>
          <h1 className="text-2xl font-semibold text-primary">
            {party.title ?? `${creatorName}'s Blend Party`}
          </h1>
          <p className="text-sm text-secondary">
            {creatorName} invited you to find movies everyone might enjoy.
          </p>
        </div>

        <div className="mb-8 flex items-center justify-center gap-2 text-sm text-secondary">
          <span className="rounded-full bg-indigo-400/10 px-3 py-1 text-xs text-indigo-300 border border-indigo-400/20">
            {party.members.length} / {party.max_participants} joined
          </span>
        </div>

        <Link
          href={`/login?redirect=${encodeURIComponent(`/blend/${token}`)}`}
          className="inline-block rounded-full bg-indigo-500 px-8 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 hover:-translate-y-0.5"
        >
          Sign in to join
        </Link>
        <p className="mt-4 text-xs text-tertiary">
          New to Nudge Film?{" "}
          <Link
            href={`/login?redirect=${encodeURIComponent(`/blend/${token}`)}`}
            className="text-indigo-400 hover:text-indigo-300"
          >
            Create an account
          </Link>{" "}
          — it&apos;s free.
        </p>
      </div>
    );
  }

  // ── Logged in — full party UI ────────────────────────────────────────────
  const isMember = party.members.some((m) => m.user_id === user.id);
  const isCreator = party.creator_id === user.id;

  return (
    <BlendPartyClient
      party={party}
      currentUserId={user.id}
      isMember={isMember}
      isCreator={isCreator}
      inviteUrl={inviteUrl}
    />
  );
}
