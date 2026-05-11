import { SettingsHub } from "./SettingsHub";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/settings");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username, bio, avatar_url, banner_url, is_public, watchlist_public, is_18_plus, show_mature_content")
    .eq("id", user.id)
    .maybeSingle();

  const providers =
    ((user.app_metadata?.providers as string[] | undefined) ?? []).map((p) => p.toLowerCase());

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8 space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-500/75">
          Control Center
        </p>
        <h1 className="text-3xl font-semibold text-primary">Settings</h1>
        <p className="text-sm text-secondary">
          Manage your account, profile look, privacy, and app preferences.
        </p>
      </header>
      <SettingsHub
        email={user.email ?? null}
        displayName={(profile?.display_name as string | null) ?? null}
        username={(profile?.username as string | null) ?? null}
        avatarUrl={(profile?.avatar_url as string | null) ?? null}
        bannerUrl={(profile?.banner_url as string | null) ?? null}
        bio={(profile?.bio as string | null) ?? null}
        isPublic={(profile?.is_public as boolean) ?? true}
        watchlistPublic={(profile?.watchlist_public as boolean) ?? true}
        is18Plus={(profile?.is_18_plus as boolean) ?? false}
        showMatureContent={(profile?.show_mature_content as boolean) ?? false}
        providers={providers}
      />
    </div>
  );
}
