"use client";

import { updateProfile } from "@/app/actions/social";
import {
  ProfileAppearance,
  type ProfileAppearanceHandle,
} from "./ProfileAppearance";
import { useRef, useState, useTransition } from "react";

type Props = {
  userId: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  isPublic: boolean;
  watchlistPublic: boolean;
  bannerUrl: string | null;
  profileBackgroundUrl: string | null;
  openInitially?: boolean;
};

export function EditProfileForm({
  userId,
  username,
  displayName,
  bio,
  isPublic,
  watchlistPublic,
  bannerUrl,
  profileBackgroundUrl,
  openInitially = false,
}: Props) {
  const [open, setOpen] = useState(openInitially);
  const [usernameVal, setUsernameVal] = useState(username ?? "");
  const [displayNameVal, setDisplayNameVal] = useState(displayName ?? "");
  const [bioVal, setBioVal] = useState(bio ?? "");
  const [isPublicVal, setIsPublicVal] = useState(isPublic);
  const [watchlistPublicVal, setWatchlistPublicVal] = useState(watchlistPublic);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const appearanceRef = useRef<ProfileAppearanceHandle>(null);

  function save() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        await updateProfile({
          username: usernameVal || undefined,
          display_name: displayNameVal || undefined,
          bio: bioVal,
          is_public: isPublicVal,
          watchlist_public: watchlistPublicVal,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed.");
        return;
      }
      try {
        await appearanceRef.current?.commitPendingRemovals();
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Profile saved, but banner/backdrop could not be removed. Try again.",
        );
        return;
      }
      setSuccess(true);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setSuccess(false); setError(null); }}
        className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-zinc-300 transition hover:border-indigo-400/25 hover:text-white"
      >
        Edit profile
      </button>
    );
  }

  return (
    <div className="w-full space-y-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold text-white">Edit Profile</h3>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-400">
            Username{" "}
            <span className="text-zinc-600">
              (3–24 chars, a–z / 0–9 / _ only)
            </span>
          </label>
          <div className="flex items-center gap-0">
            <span className="rounded-l-xl border border-r-0 border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-500">
              @
            </span>
            <input
              value={usernameVal}
              onChange={(e) => setUsernameVal(e.target.value.toLowerCase())}
              placeholder="your_username"
              maxLength={24}
              className="flex-1 rounded-r-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:ring-2 focus:ring-indigo-400/25"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-zinc-400">
            Display name
          </label>
          <input
            value={displayNameVal}
            onChange={(e) => setDisplayNameVal(e.target.value)}
            placeholder="Your name"
            maxLength={50}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:ring-2 focus:ring-indigo-400/25"
          />
        </div>

        <div>
          <label className="mb-1 flex items-center justify-between text-xs text-zinc-400">
            <span>Bio</span>
            <span className="text-zinc-600">{bioVal.length}/160</span>
          </label>
          <textarea
            value={bioVal}
            onChange={(e) => setBioVal(e.target.value)}
            placeholder="A few words about your movie taste…"
            maxLength={160}
            rows={2}
            className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:ring-2 focus:ring-indigo-400/25"
          />
        </div>

        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-3">
            <span className="relative flex h-5 w-9 items-center">
              <input
                type="checkbox"
                checked={isPublicVal}
                onChange={(e) => setIsPublicVal(e.target.checked)}
                className="peer sr-only"
              />
              <span className="h-5 w-9 rounded-full border border-white/10 bg-zinc-800 peer-checked:border-indigo-400/25 peer-checked:bg-indigo-400/20 transition" />
              <span className="absolute left-0.5 h-4 w-4 rounded-full bg-zinc-600 transition peer-checked:translate-x-4 peer-checked:bg-indigo-300" />
            </span>
            <span className="text-xs text-zinc-300">Public profile</span>
          </label>

          <label className="flex cursor-pointer items-center gap-3">
            <span className="relative flex h-5 w-9 items-center">
              <input
                type="checkbox"
                checked={watchlistPublicVal}
                onChange={(e) => setWatchlistPublicVal(e.target.checked)}
                className="peer sr-only"
              />
              <span className="h-5 w-9 rounded-full border border-white/10 bg-zinc-800 peer-checked:border-indigo-400/25 peer-checked:bg-indigo-400/20 transition" />
              <span className="absolute left-0.5 h-4 w-4 rounded-full bg-zinc-600 transition peer-checked:translate-x-4 peer-checked:bg-indigo-300" />
            </span>
            <span className="text-xs text-zinc-300">Public watchlist</span>
          </label>
        </div>
      </div>

      <ProfileAppearance
        ref={appearanceRef}
        userId={userId}
        username={username}
        bannerUrl={bannerUrl}
        profileBackgroundUrl={profileBackgroundUrl}
        embedded
      />

      {error ? (
        <p className="text-xs text-red-300/90" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={save}
          className="rounded-full bg-indigo-500 px-5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-300 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            appearanceRef.current?.resetPendingRemovals();
            setOpen(false);
          }}
          className="rounded-full border border-white/10 px-5 py-2 text-xs text-zinc-400 hover:text-white"
        >
          Cancel
        </button>
      </div>

      {success ? (
        <p className="text-xs text-indigo-300/80">Profile saved.</p>
      ) : null}
    </div>
  );
}
