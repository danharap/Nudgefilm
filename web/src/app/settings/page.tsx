import { ThemeModeSettings } from "@/components/settings/ThemeModeSettings";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/settings");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-300/70">
          Account
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Settings</h1>
      </header>
      <ThemeModeSettings />
    </div>
  );
}
