import { createClient } from "@/lib/supabase/server";
import { SiteHeaderClient } from "./SiteHeaderClient";

const publicLinks = [
  { href: "/recommend", label: "Find a film" },
  { href: "/browse", label: "Browse" },
  { href: "/feedback", label: "Reviews" },
];

const authedLinks = [
  { href: "/watchlist", label: "Watchlist" },
  { href: "/watched", label: "Watched" },
  { href: "/friends", label: "Friends" },
  { href: "/import", label: "Import" },
];

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let avatarUrl: string | null = null;
  let displayName: string | null = null;
  let isAdmin = false;
  let pendingRequestCount = 0;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, role")
      .eq("id", user.id)
      .maybeSingle();
    avatarUrl = (profile?.avatar_url as string | null) ?? null;
    displayName =
      (profile?.display_name as string | null)?.trim() ||
      user.email?.split("@")[0] ||
      "Account";
    const role = (profile?.role as string | null) ?? "user";
    isAdmin = role === "admin" || role === "super_admin" || role === "moderator";

    const { count } = await supabase
      .from("friendships")
      .select("requester_id", { count: "exact", head: true })
      .eq("addressee_id", user.id)
      .eq("status", "pending");
    pendingRequestCount = count ?? 0;
  }

  return (
    <SiteHeaderClient
      user={user}
      avatarUrl={avatarUrl}
      displayName={displayName}
      isAdmin={isAdmin}
      publicLinks={publicLinks}
      authedLinks={authedLinks}
      pendingRequestCount={pendingRequestCount}
    />
  );
}
