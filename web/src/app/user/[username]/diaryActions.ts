"use server";

import type { WatchedFilm } from "@/app/profile/FilmsSection";
import { createClient } from "@/lib/supabase/server";
import {
  fetchWatchedDiarySlice,
  PUBLIC_DIARY_PAGE_SIZE,
} from "@/features/profile/publicWatched";

export async function loadMorePublicDiary(
  userId: string,
  offset: number,
) {
  const supabase = await createClient();
  return fetchWatchedDiarySlice(supabase, userId, offset, PUBLIC_DIARY_PAGE_SIZE);
}
