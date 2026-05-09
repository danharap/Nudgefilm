"use client";

import { FilmsSection, type WatchedFilm } from "@/app/profile/FilmsSection";
import { PUBLIC_DIARY_PAGE_SIZE } from "@/features/profile/publicWatched";
import { loadMorePublicDiary } from "./diaryActions";
import { useCallback, useEffect, useRef, useState } from "react";

export function PublicDiarySection({
  userId,
  profileUsername,
  initialFilms,
  totalLogged,
}: {
  userId: string;
  /** Adds review context to poster links (movies/shows open with their diary snippet). */
  profileUsername: string | null;
  initialFilms: WatchedFilm[];
  totalLogged: number;
}) {
  const [films, setFilms] = useState(initialFilms);
  const filmsRef = useRef(films);
  filmsRef.current = films;

  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const [loadEnded, setLoadEnded] = useState(false);

  const hasMore = films.length < totalLogged && !loadEnded;

  const loadMore = useCallback(async () => {
    if (loadingRef.current || loadEnded) return;
    const offset = filmsRef.current.length;
    if (offset >= totalLogged) return;

    loadingRef.current = true;
    setLoading(true);
    try {
      const next = await loadMorePublicDiary(userId, offset);
      if (next.length === 0) {
        setLoadEnded(true);
        return;
      }
      setFilms((prev) => [...prev, ...next]);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [userId, totalLogged, loadEnded]);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "320px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore]);

  const showAllLoadedFooter =
    !hasMore && films.length > 0 && totalLogged > PUBLIC_DIARY_PAGE_SIZE;

  return (
    <>
      <FilmsSection
        films={films}
        showEditDiaryLink={false}
        profileUsernameForReviewLinks={profileUsername}
        diaryScopeNote={
          films.length < totalLogged
            ? "Sort and genre filters apply to titles loaded so far. Scroll down to load more."
            : null
        }
      />
      <div ref={sentinelRef} className="h-4 shrink-0" aria-hidden />
      {loading ? (
        <p className="py-4 text-center text-xs text-zinc-500">Loading more…</p>
      ) : null}
      {showAllLoadedFooter ? (
        <p className="pb-6 text-center text-xs text-zinc-600">
          All {totalLogged} titles loaded
        </p>
      ) : null}
    </>
  );
}
