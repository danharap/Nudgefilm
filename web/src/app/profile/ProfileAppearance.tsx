"use client";

import { revalidateUsernameProfile, updateProfile } from "@/app/actions/social";
import { createClient } from "@/lib/supabase/client";
import { Check, Loader2, X, ZoomIn, ZoomOut } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { toast } from "sonner";

export type ProfileAppearanceHandle = {
  /** Apply pending banner/backdrop removals (call after profile Save succeeds). */
  commitPendingRemovals: () => Promise<void>;
  /** Discard pending removals when user cancels editing. */
  resetPendingRemovals: () => void;
};

const BANNER_ASPECT = 21 / 9;
const BACKDROP_ASPECT = 16 / 9;
const BANNER_OUT = { w: 1680, h: 720 };
const BACKDROP_OUT = { w: 1920, h: 1080 };

async function cropToJpeg(
  imageSrc: string,
  pixelCrop: Area,
  outW: number,
  outH: number,
): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (e) => reject(e));
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outW,
    outH,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.88,
    );
  });
}

type CropKind = "banner" | "backdrop";

type Props = {
  userId: string;
  username: string | null;
  bannerUrl: string | null;
  profileBackgroundUrl: string | null;
  /** When true, tighter spacing for inside Edit profile panel */
  embedded?: boolean;
};

export const ProfileAppearance = forwardRef<ProfileAppearanceHandle, Props>(
  function ProfileAppearance(
    {
      userId,
      username,
      bannerUrl: initialBanner,
      profileBackgroundUrl: initialBg,
      embedded = false,
    },
    ref,
  ) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(typeof document !== "undefined"), []);

  const [bannerUrl, setBannerUrl] = useState(initialBanner);
  const [bgUrl, setBgUrl] = useState(initialBg);

  useEffect(() => {
    setBannerUrl(initialBanner);
    setBgUrl(initialBg);
  }, [initialBanner, initialBg]);

  /** Embedded only: removal applies when parent saves profile */
  const [pendingBannerRemoval, setPendingBannerRemoval] = useState(false);
  const [pendingBackdropRemoval, setPendingBackdropRemoval] = useState(false);

  const displayBannerUrl = embedded && pendingBannerRemoval ? null : bannerUrl;
  const displayBgUrl = embedded && pendingBackdropRemoval ? null : bgUrl;

  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropKind, setCropKind] = useState<CropKind | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  useEffect(() => {
    if (!cropSrc) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [cropSrc]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  function openFile(file: File | undefined, kind: CropKind) {
    if (!file) return;
    const maxMb = 12;
    if (file.size > maxMb * 1024 * 1024) {
      setStatus(`Image must be under ${maxMb} MB.`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setStatus("Please choose an image file.");
      return;
    }
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(URL.createObjectURL(file));
    setCropKind(kind);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setStatus(null);
  }

  function cancelCrop() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setCropKind(null);
    setCroppedAreaPixels(null);
  }

  function confirmCrop() {
    if (!cropSrc || !cropKind) return;
    if (!croppedAreaPixels) {
      toast.error("Image is still loading — wait a moment or pinch to adjust, then tap Save.");
      return;
    }

    const kind = cropKind;
    const src = cropSrc;
    const pixels = croppedAreaPixels;
    setCropSrc(null);
    setCropKind(null);
    setCroppedAreaPixels(null);

    setStatus("Uploading…");
    startTransition(async () => {
      try {
        const dims = kind === "banner" ? BANNER_OUT : BACKDROP_OUT;
        const blob = await cropToJpeg(src, pixels, dims.w, dims.h);
        URL.revokeObjectURL(src);

        const supabase = createClient();
        const path =
          kind === "banner" ? `${userId}/banner.jpg` : `${userId}/profile-bg.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, blob, { upsert: true, contentType: "image/jpeg" });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        const url = `${data.publicUrl}?t=${Date.now()}`;

        await updateProfile(
          kind === "banner"
            ? { banner_url: url }
            : { profile_background_url: url },
        );

        if (kind === "banner") {
          setBannerUrl(url);
          setPendingBannerRemoval(false);
        } else {
          setBgUrl(url);
          setPendingBackdropRemoval(false);
        }

        toast.success(kind === "banner" ? "Banner saved." : "Backdrop saved.");
        setStatus(null);
        if (username) await revalidateUsernameProfile(username);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed.";
        setStatus(msg);
        toast.error(msg);
      }
    });
  }

  async function persistRemove(kind: CropKind): Promise<void> {
    const supabase = createClient();
    const path =
      kind === "banner" ? `${userId}/banner.jpg` : `${userId}/profile-bg.jpg`;
    await supabase.storage.from("avatars").remove([path]).catch(() => {});

    await updateProfile(
      kind === "banner"
        ? { banner_url: null }
        : { profile_background_url: null },
    );

    if (kind === "banner") setBannerUrl(null);
    else setBgUrl(null);

    if (username) await revalidateUsernameProfile(username);
  }

  useImperativeHandle(
    ref,
    () => ({
      resetPendingRemovals: () => {
        setPendingBannerRemoval(false);
        setPendingBackdropRemoval(false);
      },
      commitPendingRemovals: async () => {
        if (!embedded) return;
        const removeBanner = pendingBannerRemoval;
        const removeBackdrop = pendingBackdropRemoval;
        if (!removeBanner && !removeBackdrop) return;
        try {
          if (removeBanner) {
            await persistRemove("banner");
            setPendingBannerRemoval(false);
          }
          if (removeBackdrop) {
            await persistRemove("backdrop");
            setPendingBackdropRemoval(false);
          }
          let msg = "Removed.";
          if (removeBanner && removeBackdrop) msg = "Banner and backdrop removed.";
          else if (removeBanner) msg = "Banner removed.";
          else if (removeBackdrop) msg = "Backdrop removed.";
          toast.success(msg);
          router.refresh();
        } catch (e) {
          const err = e instanceof Error ? e.message : "Could not remove images.";
          toast.error(err);
          throw e;
        }
      },
    }),
    [embedded, pendingBannerRemoval, pendingBackdropRemoval, userId, username, router],
  );

  function requestRemove(kind: CropKind) {
    if (embedded) {
      if (kind === "banner") setPendingBannerRemoval(true);
      else setPendingBackdropRemoval(true);
      setStatus(null);
      return;
    }
    setStatus(null);
    startTransition(async () => {
      try {
        await persistRemove(kind);
        toast.success(kind === "banner" ? "Banner removed." : "Backdrop removed.");
        setStatus(null);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not remove.";
        setStatus(msg);
        toast.error(msg);
      }
    });
  }

  const aspect =
    cropKind === "banner" ? BANNER_ASPECT : cropKind === "backdrop" ? BACKDROP_ASPECT : 1;

  const cropModal =
    cropSrc && cropKind && mounted ? (
      <div
        className="fixed inset-0 z-[9999] flex max-h-dvh flex-col overflow-hidden overscroll-none bg-[#09090b]"
        style={{
          height: "100dvh",
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2 sm:px-4 sm:py-3">
          <button
            type="button"
            onClick={cancelCrop}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white sm:gap-1.5 sm:px-3"
            aria-label="Cancel crop"
          >
            <X className="h-5 w-5 shrink-0 sm:h-4 sm:w-4" />
            <span className="hidden text-sm sm:inline">Cancel</span>
          </button>
          <h2 className="min-w-0 flex-1 truncate text-center text-xs font-semibold text-white sm:text-sm">
            {cropKind === "banner" ? "Crop banner (21∶9)" : "Crop backdrop (16∶9)"}
          </h2>
          <button
            type="button"
            onClick={confirmCrop}
            disabled={isPending || !croppedAreaPixels}
            className="flex min-h-[44px] items-center justify-center gap-1 rounded-full bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-40 sm:px-4"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Check className="h-4 w-4 shrink-0 sm:hidden" aria-hidden />
            )}
            <span>{isPending ? "…" : "Save"}</span>
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          <Cropper
            image={cropSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape="rect"
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: {
                background: "#09090b",
              },
              cropAreaStyle: {
                border: "2px solid rgba(129, 140, 248, 0.85)",
              },
            }}
          />
        </div>

        <div className="shrink-0 space-y-3 border-t border-white/10 bg-zinc-950 px-4 py-3">
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, z - 0.1))}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-11 min-w-0 flex-1 max-w-xs accent-indigo-400"
              aria-label="Zoom"
            />
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
          </div>

          {!croppedAreaPixels ? (
            <p className="text-center text-[11px] text-zinc-500">Preparing crop…</p>
          ) : null}

          <div className="flex gap-2 sm:hidden">
            <button
              type="button"
              onClick={cancelCrop}
              className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-white/15 text-sm font-medium text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmCrop}
              disabled={isPending || !croppedAreaPixels}
              className="flex min-h-[48px] flex-[1.15] items-center justify-center gap-2 rounded-xl bg-indigo-500 text-sm font-semibold text-white disabled:opacity-40"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save & upload
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <div
        className={
          embedded
            ? "border-t border-white/10 pt-4 mt-4"
            : "mt-6 rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5"
        }
      >
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
          Banner & backdrop
        </h3>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
          Optional wide banner and page background for your profile (shown on your public link too).
        </p>

        <div className="mt-3 grid max-w-full gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-medium text-zinc-400">Banner · 21∶9</p>
            <div
              className={`relative aspect-[21/9] w-full max-h-[120px] overflow-hidden rounded-lg border bg-zinc-900/80 sm:max-h-none sm:rounded-xl ${
                embedded && pendingBannerRemoval ? "border-amber-500/40" : "border-white/10"
              }`}
            >
              {displayBannerUrl ? (
                <Image
                  src={displayBannerUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width:640px) 100vw, 448px"
                  unoptimized
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-[10px] text-zinc-600">
                  {embedded && pendingBannerRemoval ? (
                    <>
                      <span className="text-amber-200/90">Will remove when you save profile</span>
                      <span className="text-zinc-600">(or tap Undo remove)</span>
                    </>
                  ) : (
                    "Preview after upload"
                  )}
                </div>
              )}
            </div>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => openFile(e.target.files?.[0], "banner")}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => bannerInputRef.current?.click()}
                className="min-h-[40px] rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs text-zinc-200 transition hover:border-indigo-400/30 hover:text-white disabled:opacity-50"
              >
                Upload banner
              </button>
              {embedded && pendingBannerRemoval ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setPendingBannerRemoval(false)}
                  className="min-h-[40px] rounded-full border border-white/15 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-50"
                >
                  Undo remove
                </button>
              ) : bannerUrl ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => requestRemove("banner")}
                  className="min-h-[40px] rounded-full px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>

          <div className="min-w-0 space-y-2">
            <p className="text-xs font-medium text-zinc-400">Page background · 16∶9</p>
            <div
              className={`relative aspect-video w-full max-h-[140px] overflow-hidden rounded-lg border bg-zinc-900/80 sm:max-h-none sm:rounded-xl ${
                embedded && pendingBackdropRemoval ? "border-amber-500/40" : "border-white/10"
              }`}
            >
              {displayBgUrl ? (
                <Image
                  src={displayBgUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width:640px) 100vw, 360px"
                  unoptimized
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-[10px] text-zinc-600">
                  {embedded && pendingBackdropRemoval ? (
                    <>
                      <span className="text-amber-200/90">Will remove when you save profile</span>
                      <span className="text-zinc-600">(or tap Undo remove)</span>
                    </>
                  ) : (
                    "Full-page backdrop behind content"
                  )}
                </div>
              )}
            </div>
            <input
              ref={bgInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => openFile(e.target.files?.[0], "backdrop")}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => bgInputRef.current?.click()}
                className="min-h-[40px] rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs text-zinc-200 transition hover:border-indigo-400/30 hover:text-white disabled:opacity-50"
              >
                Upload backdrop
              </button>
              {embedded && pendingBackdropRemoval ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setPendingBackdropRemoval(false)}
                  className="min-h-[40px] rounded-full border border-white/15 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-50"
                >
                  Undo remove
                </button>
              ) : bgUrl ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => requestRemove("backdrop")}
                  className="min-h-[40px] rounded-full px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {status ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-zinc-400" role="status">
            {isPending ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden /> : null}
            {status}
          </p>
        ) : null}
      </div>

      {mounted && cropModal ? createPortal(cropModal, document.body) : null}
    </>
  );
});

ProfileAppearance.displayName = "ProfileAppearance";
