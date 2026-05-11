"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, Sparkles, Copy, ChevronRight } from "lucide-react";
import { createBlendParty } from "@/app/blend/actions";
import { getConfiguredOrigin } from "@/lib/site-url";

export function BlendPartySection() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreated, setShowCreated] = useState(false);
  const [partyToken, setPartyToken] = useState<string | null>(null);

  const inviteUrl = partyToken
    ? `${getConfiguredOrigin()}/blend/${partyToken}`
    : null;

  function handleCreate() {
    startTransition(async () => {
      const result = await createBlendParty();
      if (result.ok) {
        setPartyToken(result.token);
        setShowCreated(true);
      } else {
        toast.error(result.error);
      }
    });
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "Join my Blend Party",
          text: "Find movies we all might enjoy on Nudge Film!",
          url: inviteUrl,
        });
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        toast.success("Invite link copied.");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(inviteUrl!);
        toast.success("Invite link copied.");
      } catch {
        toast.error("Couldn't copy link.");
      }
    }
  }

  function handleOpen() {
    if (partyToken) router.push(`/blend/${partyToken}`);
  }

  return (
    <section className="mb-10">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-primary">Blend Party</h2>
        <p className="mt-0.5 text-xs text-tertiary">
          Invite up to 4 friends and find a film everyone might enjoy.
        </p>
      </div>

      {!showCreated ? (
        <div className="surface-card-subtle rounded-2xl border p-5">
          <div className="mb-4 flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 border border-indigo-400/20">
              <Users className="size-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Create a Blend Party</p>
              <p className="mt-0.5 text-xs text-tertiary">
                Blend everyone&apos;s taste into one shortlist. Works with 2–5 people.
              </p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            {[
              { step: "1", label: "Create a link" },
              { step: "2", label: "Friends join" },
              { step: "3", label: "Get picks" },
            ].map(({ step, label }) => (
              <div
                key={step}
                className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)] py-2.5 px-1"
              >
                <p className="text-xs font-semibold text-indigo-400">{step}</p>
                <p className="mt-0.5 text-[10px] text-tertiary">{label}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:bg-indigo-400 hover:-translate-y-0.5 disabled:opacity-60"
          >
            <Sparkles className="size-4 transition group-hover:scale-110" />
            {isPending ? "Creating…" : "Create a Blend Party"}
          </button>
        </div>
      ) : (
        <div className="surface-card-subtle rounded-2xl border p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/20 border border-indigo-400/30">
              <span className="text-xs text-indigo-300">✓</span>
            </div>
            <p className="text-sm font-medium text-primary">Party created!</p>
          </div>

          <p className="text-xs text-secondary">
            Send the invite link to friends. They can join directly — no account needed to preview,
            sign-in required to join.
          </p>

          {/* Link display */}
          <div className="flex items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)] p-2.5">
            <p className="min-w-0 flex-1 truncate text-[11px] font-mono text-tertiary">
              {inviteUrl}
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-3)] px-2.5 py-1.5 text-[11px] font-medium text-secondary transition hover:border-indigo-400/30 hover:text-indigo-300"
            >
              <Copy className="size-3" />
              Copy
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-400"
            >
              Share invite
            </button>
            <button
              type="button"
              onClick={handleOpen}
              className="flex items-center gap-1 rounded-xl border border-[var(--surface-border)] px-4 py-2.5 text-xs font-medium text-secondary transition hover:border-indigo-400/30 hover:text-indigo-300"
            >
              Open party
              <ChevronRight className="size-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => { setShowCreated(false); setPartyToken(null); }}
            className="text-[11px] text-tertiary transition hover:text-secondary"
          >
            Create another party
          </button>
        </div>
      )}
    </section>
  );
}
