"use client";

import {
  setFavouriteEntryCustomPoster,
  setWatchedEntryCustomPoster,
} from "@/app/actions/library";
import { createClient } from "@/lib/supabase/client";
import { ImagePlus, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

async function compressToJpeg(file: File, maxW = 800): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxW / bitmap.width);
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve, reject) => {
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

  async function uploadBlob(blob: Blob) {
    const supabase = createClient();
    // First path segment must be auth.uid() — matches avatars bucket RLS (see AvatarUpload).
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

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;

    startTransition(async () => {
      setBusy(true);
      try {
        const blob = await compressToJpeg(file);
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
        toast.error(err instanceof Error ? err.message : "Could not save cover.");
      } finally {
        setBusy(false);
      }
    });
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

  return (
    <div
      className="pointer-events-none absolute right-0.5 top-0.5 z-20 flex gap-0.5 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100"
    >
      {/*
        Must not use display:none — Safari and others block programmatic input.click().
        sr-only keeps the input focusable for a11y without showing it.
      */}
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
          // Sync call inside user gesture — required for file picker.
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
  );
}
