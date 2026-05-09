"use client";

import {
  setFavouriteEntryCustomPoster,
  setWatchedEntryCustomPoster,
} from "@/app/actions/library";
import { createClient } from "@/lib/supabase/client";
import { Check, ImagePlus, Loader2, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { toast } from "sonner";

/** Portrait poster frame (matches diary / TMDb cards). */
const POSTER_ASPECT = 2 / 3;
const POSTER_OUT = { w: 800, h: 1200 };

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
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode image"))),
      "image/jpeg",
      0.88,
    );
  });
}

type WatchedProps = {
  variant: "watched";
  userId: string;
  watchedRowId: number;
  hasCustom: boolean;
};

type FavouriteProps = {
  variant: "favourite";
  userId: string;
  position: 1 | 2 | 3 | 4;
  hasCustom: boolean;
  slotFilled: boolean;
};

type Props = WatchedProps | FavouriteProps;

export function LibraryPosterEditor(props: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  useEffect(() => setMounted(typeof document !== "undefined"), []);

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

  async function uploadBlob(blob: Blob) {
    const supabase = createClient();
    const path =
      props.variant === "watched"
        ? `${props.userId}/custom-posters/watched-${props.watchedRowId}.jpg`
        : `${props.userId}/custom-posters/favourite-${props.position}.jpg`;

    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
    if (upErr) {
      throw new Error(upErr.message || "Upload failed");
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl;
  }

  function handleFileSelect(file: File) {
    const maxMb = 12;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`Image must be under ${maxMb} MB.`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }

  function cancelCrop() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setCroppedAreaPixels(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function confirmCrop() {
    if (!cropSrc || !croppedAreaPixels) {
      toast.error("Wait for the image to load, then try Save again.");
      return;
    }

    const src = cropSrc;
    const pixels = croppedAreaPixels;
    setCropSrc(null);
    setCroppedAreaPixels(null);
    if (inputRef.current) inputRef.current.value = "";

    startTransition(async () => {
      setBusy(true);
      let blobUrlRevoked = false;
      try {
        const blob = await cropToJpeg(src, pixels, POSTER_OUT.w, POSTER_OUT.h);
        URL.revokeObjectURL(src);
        blobUrlRevoked = true;
        const url = await uploadBlob(blob);
        if (props.variant === "watched") {
          await setWatchedEntryCustomPoster(props.watchedRowId, url);
        } else {
          if (!props.slotFilled) {
            toast.error("Pick a title for this slot first.");
            return;
          }
          await setFavouriteEntryCustomPoster(props.position, url);
        }
        toast.success("Cover updated.");
        router.refresh();
      } catch (err) {
        if (!blobUrlRevoked) URL.revokeObjectURL(src);
        toast.error(err instanceof Error ? err.message : "Could not save cover.");
      } finally {
        setBusy(false);
      }
    });
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    handleFileSelect(file);
  }

  function onReset() {
    if (props.variant === "favourite" && !props.slotFilled) return;
    startTransition(async () => {
      try {
        if (props.variant === "watched") {
          await setWatchedEntryCustomPoster(props.watchedRowId, null);
        } else {
          await setFavouriteEntryCustomPoster(props.position, null);
        }
        toast.success("Cover reset to TMDb poster.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not reset.");
      }
    });
  }

  const disabled = pending || busy;
  const showReset =
    props.hasCustom && (props.variant === "watched" || props.slotFilled);

  const cropModal =
    cropSrc && mounted ? (
      <div
        className="fixed inset-0 z-[9999] flex flex-col bg-[#09090b]"
        style={{
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
          <h2 className="min-w-0 truncate text-center text-xs font-semibold text-white sm:text-sm">
            Crop poster (2∶3)
          </h2>
          <button
            type="button"
            onClick={confirmCrop}
            disabled={disabled || !croppedAreaPixels}
            className="flex min-h-[44px] items-center justify-center gap-1 rounded-full bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-40 sm:px-4"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Check className="h-4 w-4 shrink-0 sm:hidden" aria-hidden />
            )}
            <span>{busy ? "…" : "Save"}</span>
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          <Cropper
            image={cropSrc}
            crop={crop}
            zoom={zoom}
            aspect={POSTER_ASPECT}
            cropShape="rect"
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: { background: "#09090b" },
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
              disabled={disabled || !croppedAreaPixels}
              className="flex min-h-[48px] flex-[1.15] items-center justify-center gap-2 rounded-xl bg-indigo-500 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save & upload
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <div
        className="pointer-events-none absolute right-0.5 top-0.5 z-20 flex gap-0.5 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          onChange={onPickFile}
        />
        <button
          type="button"
          disabled={disabled || (props.variant === "favourite" && !props.slotFilled)}
          title="Upload custom cover"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            inputRef.current?.click();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex size-7 items-center justify-center rounded-md bg-black/75 text-white ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-black/90 disabled:opacity-40"
        >
          <ImagePlus className="size-3.5" />
        </button>
        {showReset ? (
          <button
            type="button"
            disabled={disabled}
            title="Use TMDb poster again"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onReset();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex size-7 items-center justify-center rounded-md bg-black/75 text-white ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-black/90 disabled:opacity-40"
          >
            <RotateCcw className="size-3.5" />
          </button>
        ) : null}
      </div>
      {mounted && cropModal ? createPortal(cropModal, document.body) : null}
    </>
  );
}
