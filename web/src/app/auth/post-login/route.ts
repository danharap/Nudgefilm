import { syncProfileFromAuthUser } from "@/features/profile/syncProfileFromAuthUser";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * After sign-in, send users to first-run onboarding or profile.
 * Login form uses this as the default `redirect` target.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await syncProfileFromAuthUser(supabase, user);

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarding_completed_at) {
    redirect("/onboarding");
  }

  redirect("/profile");
}
