import { syncProfileFromAuthUser } from "@/features/profile/syncProfileFromAuthUser";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "./OnboardingWizard";

export const metadata = {
  title: "Welcome to Nudge Film",
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await syncProfileFromAuthUser(supabase, user);

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarding_completed_at) redirect("/profile");

  const displayName =
    (profile?.display_name as string | null)?.trim() ||
    user.email?.split("@")[0] ||
    "there";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <OnboardingWizard displayName={displayName} />
    </main>
  );
}
