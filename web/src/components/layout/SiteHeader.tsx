import { createClient } from "@/lib/supabase/server";
import { SiteHeaderClient } from "./SiteHeaderClient";

const publicLinks = [
  { href: "/browse", label: "Browse" },
  { href: "/feedback", label: "Reviews" },
];

const authedLinks = [
  { href: "/watchlist", label: "Watchlist" },
  { href: "/friends", label: "Social" },
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
  let notificationCount = 0;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, role, social_inbox_last_read_at")
      .eq("id", user.id)
      .maybeSingle();
    const metaAvatar =
      (typeof user.user_metadata?.avatar_url === "string" &&
        user.user_metadata.avatar_url) ||
      (typeof user.user_metadata?.picture === "string" &&
        user.user_metadata.picture) ||
      null;
    avatarUrl = (profile?.avatar_url as string | null) || metaAvatar;
    // Fall back chain: profiles.display_name → OAuth full_name/name metadata →
    // email prefix. This prevents the header from showing a raw email prefix
    // on first login before syncProfileFromAuthUser has had a chance to write.
    const metaName =
      (typeof user.user_metadata?.full_name === "string" &&
        user.user_metadata.full_name.trim()) ||
      (typeof user.user_metadata?.name === "string" &&
        user.user_metadata.name.trim()) ||
      null;
    displayName =
      (profile?.display_name as string | null)?.trim() ||
      metaName ||
      user.email?.split("@")[0] ||
      "Account";
    const role = (profile?.role as string | null) ?? "user";
    isAdmin = role === "admin" || role === "super_admin" || role === "moderator";

    const lastRead = (profile?.social_inbox_last_read_at as string | null | undefined) ?? null;
    let followsQuery = supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", user.id);
    if (lastRead) {
      followsQuery = followsQuery.gt("created_at", lastRead);
    }
    const { count } = await followsQuery;
    notificationCount = count ?? 0;
  }

  return (
    <SiteHeaderClient
      user={user}
      avatarUrl={avatarUrl}
      displayName={displayName}
      isAdmin={isAdmin}
      publicLinks={publicLinks}
      authedLinks={authedLinks}
      pendingRequestCount={notificationCount}
    />
  );
}
