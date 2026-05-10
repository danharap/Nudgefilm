"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/** Call when the user opens the social inbox; new follows after this moment surface on the badge. */
export async function markSocialInboxRead(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("profiles")
    .update({ social_inbox_last_read_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    console.error("[social] markSocialInboxRead:", error.message);
    return { ok: false };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
