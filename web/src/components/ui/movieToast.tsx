"use client";

import { posterUrl } from "@/lib/tmdb/constants";
import TmdbImage from "@/components/ui/TmdbImage";
import { toast } from "sonner";

export function movieToast(message: string, title: string, posterPath?: string | null) {
  const src = posterUrl(posterPath ?? null, "w92");
  toast.success(message, {
    description: title,
    icon: src ? (
      <span className="relative block h-10 w-7 overflow-hidden rounded-md border border-white/20">
        <TmdbImage src={src} alt="" fill sizes="28px" className="object-cover" />
      </span>
    ) : undefined,
  });
}
