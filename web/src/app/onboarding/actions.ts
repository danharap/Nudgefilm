"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const HEARD_FROM_VALUES = new Set(["friend", "social", "search", "other"]);

function normalizeHeardFrom(raw: string | null | undefined): string | null {
  if (raw == null || raw === "") return null;
  return HEARD_FROM_VALUES.has(raw) ? raw : null;
}

export async function completeOnboarding(heardFrom?: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const referral = normalizeHeardFrom(heardFrom ?? null);

  const { data: existing, error: readErr } = await supabase
    .from("profiles")
    .select("heard_from")
    .eq("id", user.id)
    .maybeSingle();

  if (readErr) return { ok: false as const, error: readErr.message };

  const patch: { onboarding_completed_at: string; heard_from?: string } = {
    onboarding_completed_at: new Date().toISOString(),
  };
  if (referral && existing && !existing.heard_from) {
    patch.heard_from = referral;
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/profile");
  revalidatePath("/onboarding");
  return { ok: true as const };
}
