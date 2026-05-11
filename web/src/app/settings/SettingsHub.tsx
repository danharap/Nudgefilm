"use client";

import { signOut } from "@/app/actions/auth";
import { updateProfile } from "@/app/actions/social";
import { ThemeModeSettings } from "@/components/settings/ThemeModeSettings";
import { Bell, Bookmark, Film, Globe, Lock, Mail, Play, Shield, Sparkles, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

type ToggleKey =
  | "notifyFriendActivity"
  | "notifyRecommendations"
  | "notifyReviewLikes"
  | "hideWatchedInBrowse"
  | "autoplayTrailers";

type Props = {
  email: string | null;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  isPublic: boolean;
  watchlistPublic: boolean;
  is18Plus: boolean;
  showMatureContent: boolean;
  providers: string[];
};

const TOGGLE_STORAGE_KEY = "nudge-settings-preferences-v1";

function SettingsToggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-3 ${disabled ? "opacity-60" : ""}`}>
      <div>
        <p className="text-sm font-medium text-primary">{label}</p>
        <p className="mt-0.5 text-xs text-tertiary">{description}</p>
      </div>
      <span className="relative mt-0.5 flex h-5 w-9 items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="peer sr-only"
          aria-label={label}
        />
        <span className="h-5 w-9 rounded-full border border-white/10 bg-zinc-800 transition peer-checked:border-indigo-400/25 peer-checked:bg-indigo-400/20" />
        <span className="absolute left-0.5 h-4 w-4 rounded-full bg-zinc-500 transition peer-checked:translate-x-4 peer-checked:bg-indigo-300" />
      </span>
    </label>
  );
}

export function SettingsHub({
  email,
  displayName,
  username,
  avatarUrl,
  bannerUrl,
  bio,
  isPublic,
  watchlistPublic,
  is18Plus,
  showMatureContent,
  providers,
}: Props) {
  const [matureEnabled, setMatureEnabled] = useState(showMatureContent);
  const [, startTransition] = useTransition();

  function handleMatureToggle(v: boolean) {
    setMatureEnabled(v);
    startTransition(() => {
      updateProfile({ show_mature_content: v });
    });
  }

  const [prefs, setPrefs] = useState<Record<ToggleKey, boolean>>({
    notifyFriendActivity: true,
    notifyRecommendations: true,
    notifyReviewLikes: true,
    hideWatchedInBrowse: false,
    autoplayTrailers: false,
  });

  useEffect(() => {
    const raw = localStorage.getItem(TOGGLE_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<Record<ToggleKey, boolean>>;
      setPrefs((prev) => ({ ...prev, ...parsed }));
    } catch {
      // ignore malformed preferences
    }
  }, []);

  function setPref(key: ToggleKey, value: boolean) {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(TOGGLE_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const primaryProvider = providers.includes("google") ? "Google" : providers[0] ?? "Email";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(165deg,rgba(16,20,40,0.88),rgba(8,11,24,0.82))] p-4 shadow-[0_14px_40px_-30px_rgba(99,102,241,0.45)] sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <UserRound className="size-4 text-indigo-300" />
            <h2 className="text-base font-semibold text-primary">Profile</h2>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-3 overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
              <div className="relative aspect-[5/1.8] w-full">
                {bannerUrl ? (
                  <Image src={bannerUrl} alt="" fill className="object-cover" sizes="640px" unoptimized />
                ) : (
                  <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.35),rgba(10,12,25,0.95))]" />
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 overflow-hidden rounded-full border border-white/10 bg-zinc-800">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={displayName ?? "Profile avatar"} fill className="object-cover" sizes="48px" unoptimized />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-indigo-300">
                    {(displayName ?? username ?? "N").slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-primary">{displayName || "Your profile"}</p>
                <p className="truncate text-xs text-tertiary">{username ? `@${username}` : "Add a username"}</p>
              </div>
            </div>
            {bio ? <p className="mt-2 line-clamp-2 text-xs text-tertiary">{bio}</p> : null}
          </div>
          <Link
            href="/profile?edit=1#profile-edit"
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/20"
          >
            <Sparkles className="size-4" />
            Customize Profile
          </Link>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[var(--surface-1)]/80 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Bell className="size-4 text-indigo-300" />
            <h2 className="text-base font-semibold text-primary">Notifications</h2>
          </div>
          <div className="space-y-2.5">
            <SettingsToggle
              checked={prefs.notifyFriendActivity}
              onChange={(v) => setPref("notifyFriendActivity", v)}
              label="Friend activity"
              description="Get notified when people you follow log or rate titles."
            />
            <SettingsToggle
              checked={prefs.notifyRecommendations}
              onChange={(v) => setPref("notifyRecommendations", v)}
              label="Recommendation updates"
              description="Notify me when fresh picks are ready."
            />
            <SettingsToggle
              checked={prefs.notifyReviewLikes}
              onChange={(v) => setPref("notifyReviewLikes", v)}
              label="Review likes & comments"
              description="Receive alerts for social interactions on your activity."
            />
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">Stored locally for now; server sync coming soon.</p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[var(--surface-1)]/80 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Film className="size-4 text-indigo-300" />
            <h2 className="text-base font-semibold text-primary">Discovery Preferences</h2>
          </div>
          <div className="space-y-2.5">
            {is18Plus ? (
              <SettingsToggle
                checked={matureEnabled}
                onChange={handleMatureToggle}
                label="Show 18+ content"
                description="Include mature and R-rated films in Browse and recommendations."
              />
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-sm font-medium text-primary">Show 18+ content</p>
                <p className="mt-0.5 text-xs text-tertiary">
                  Verify your age during onboarding to enable mature content.
                </p>
              </div>
            )}
            <SettingsToggle
              checked={prefs.hideWatchedInBrowse}
              onChange={(v) => setPref("hideWatchedInBrowse", v)}
              label="Hide watched in Browse"
              description="Prefer unseen titles while exploring."
            />
            <SettingsToggle
              checked={prefs.autoplayTrailers}
              onChange={(v) => setPref("autoplayTrailers", v)}
              label="Autoplay trailer previews"
              description="Play trailers automatically when available."
            />
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-sm font-medium text-primary">Streaming region</p>
              <p className="mt-0.5 text-xs text-tertiary">Default region is Canada (CA) for watch providers.</p>
              <p className="mt-2 text-xs text-zinc-500">Region selector support is planned.</p>
            </div>
          </div>
        </section>
      </div>

      <div className="space-y-4">
        <section className="rounded-2xl border border-white/10 bg-[var(--surface-1)]/80 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="size-4 text-indigo-300" />
            <h2 className="text-base font-semibold text-primary">Account</h2>
          </div>
          <div className="space-y-2.5">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Email</p>
              <p className="mt-1 text-sm text-primary">{email ?? "Unknown"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Connected account</p>
              <p className="mt-1 text-sm text-primary">{primaryProvider} connected</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                <span className={`rounded-full px-2 py-0.5 ${providers.includes("google") ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-zinc-500"}`}>Google</span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-zinc-500">Apple (soon)</span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-zinc-500">Microsoft (soon)</span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-zinc-500">Discord (soon)</span>
              </div>
            </div>
            <Link href="/login" className="inline-flex min-h-10 items-center rounded-lg border border-white/10 px-3 py-2 text-sm text-secondary transition hover:text-primary">
              Password & Security
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex min-h-10 items-center rounded-lg border border-white/10 px-3 py-2 text-sm text-secondary transition hover:text-primary"
              >
                Log out
              </button>
            </form>
            <button
              type="button"
              disabled
              className="inline-flex min-h-10 items-center rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300/80"
              aria-label="Delete account coming soon"
            >
              Delete account (coming soon)
            </button>
          </div>
        </section>

        <ThemeModeSettings />

        <section className="rounded-2xl border border-white/10 bg-[var(--surface-1)]/80 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Lock className="size-4 text-indigo-300" />
            <h2 className="text-base font-semibold text-primary">Privacy & Social</h2>
          </div>
          <div className="space-y-2.5">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
              <p className="text-primary">Profile visibility: <span className="text-indigo-200">{isPublic ? "Public" : "Private"}</span></p>
              <p className="mt-1 text-tertiary">Watchlist visibility: <span className="text-indigo-200">{watchlistPublic ? "Public" : "Private"}</span></p>
              <Link href="/profile?edit=1#profile-edit" className="mt-2 inline-flex text-xs text-indigo-300 hover:text-indigo-200">
                Manage privacy in profile editor →
              </Link>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-500">
              Friend requests, follower permissions, and spoiler visibility controls are planned for this section.
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[var(--surface-1)]/80 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Bookmark className="size-4 text-indigo-300" />
            <h2 className="text-base font-semibold text-primary">Data & Import</h2>
          </div>
          <div className="space-y-2.5">
            <Link href="/import" className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-primary transition hover:border-indigo-400/30">
              <Mail className="size-4 text-indigo-300" />
              Import Letterboxd data
            </Link>
            <button
              type="button"
              disabled
              className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-left text-sm text-zinc-500"
            >
              <Globe className="size-4" />
              Export account data (coming soon)
            </button>
            <button
              type="button"
              disabled
              className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-left text-sm text-zinc-500"
            >
              <Play className="size-4" />
              Clear recommendations cache (coming soon)
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
