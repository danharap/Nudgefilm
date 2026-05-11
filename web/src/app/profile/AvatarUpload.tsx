"use client";

import { updateProfile } from "@/app/actions/social";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { ZoomIn, ZoomOut, Check, X, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Canvas crop helper
// ---------------------------------------------------------------------------

async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Area,
): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (e) => reject(e));
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  const size = 400; // output 400×400px
  canvas.width = size;
  canvas.height = size;
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
    size,
    size,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/jpeg",
      0.9,
    );
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AvatarUpload({
  userId,
  currentUrl,
  displayName,
}: {
  userId: string;
  currentUrl: string | null;
  displayName: string;
}) {
  const [liveUrl, setLiveUrl] = useState<string | null>(currentUrl);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Crop modal state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  useEffect(() => {
    if (!cropSrc) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [cropSrc]);

  function handleFileSelect(file: File) {
    const maxMb = 10;
    if (file.size > maxMb * 1024 * 1024) {
      setStatus(`Image must be under ${maxMb} MB.`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setStatus("Please select an image file.");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setStatus(null);
  }

  function cancelCrop() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function confirmCrop() {
    if (!cropSrc || !croppedAreaPixels) return;

    setStatus("Uploading…");
    setCropSrc(null);

    startTransition(async () => {
      try {
        const blob = await getCroppedBlob(cropSrc, croppedAreaPixels);
        URL.revokeObjectURL(cropSrc);

        const supabase = createClient();
        const path = `${userId}/avatar.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, blob, { upsert: true, contentType: "image/jpeg" });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        // Bust CDN cache with timestamp so Next.js Image picks up the new file
        const url = `${data.publicUrl}?t=${Date.now()}`;

        await updateProfile({ avatar_url: url });

        // Update local preview to the real CDN URL (not the blob)
        setLiveUrl(url);
        setStatus("Avatar saved.");
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Upload failed.");
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <>
      {/* Avatar button */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
          className="group relative h-20 w-20 overflow-hidden rounded-full bg-zinc-800 ring-2 ring-white/10 transition hover:ring-indigo-400/30 disabled:opacity-60"
          aria-label="Change avatar"
        >
          {liveUrl ? (
            <Image
              src={liveUrl}
              alt={displayName}
              fill
              className="object-cover"
              sizes="80px"
              unoptimized
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-indigo-300 select-none">
              {displayName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
            {isPending ? (
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            ) : (
              <span className="text-xs font-medium text-white">Change</span>
            )}
          </span>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileSelect(f);
          }}
        />

        {status ? (
          <p className="text-xs text-zinc-400" role="status">
            {status}
          </p>
        ) : (
          <p className="text-xs text-zinc-600">Click to change</p>
        )}
      </div>

      {/* Crop modal */}
      {cropSrc && (
        <div
          className="fixed inset-0 z-50 flex max-h-dvh flex-col overflow-hidden overscroll-none bg-black/95"
          style={{
            height: "100dvh",
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2 sm:px-4 sm:py-3">
            <button
              type="button"
              onClick={cancelCrop}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full text-sm text-zinc-400 hover:bg-white/10 hover:text-white sm:px-3"
              aria-label="Cancel crop"
            >
              <X className="h-5 w-5 shrink-0 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Cancel</span>
            </button>
            <h2 className="min-w-0 flex-1 truncate text-center text-xs font-semibold text-white sm:text-sm">
              Crop photo
            </h2>
            <button
              type="button"
              onClick={confirmCrop}
              disabled={isPending || !croppedAreaPixels}
              className="flex min-h-[44px] shrink-0 items-center justify-center gap-1 rounded-full bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-40 sm:gap-1.5 sm:px-4"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Check className="h-4 w-4 shrink-0 sm:hidden" aria-hidden />
              )}
              <span>{isPending ? "…" : "Save"}</span>
            </button>
          </div>

          {/* Cropper canvas — min-h-0 so flex child cannot overflow the viewport */}
          <div className="relative min-h-0 flex-1">
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              style={{
                containerStyle: { background: "#09090b" },
              }}
            />
          </div>

          {/* Zoom + primary actions (footer always visible on small screens) */}
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
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
