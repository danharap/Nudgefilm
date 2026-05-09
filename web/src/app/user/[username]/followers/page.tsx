import { FollowListView } from "@/components/social/FollowListView";
import { getFollowers, getProfileByUsername } from "@/features/users/service";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function UserFollowersPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const target = await getProfileByUsername(username);
  if (!target) notFound();

  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (currentUser?.id === target.id) {
    redirect("/profile/followers");
  }

  const profiles = await getFollowers(target.id);
  const slug = target.username ?? username;

  return (
    <FollowListView
      title="Followers"
      backHref={`/user/${encodeURIComponent(slug)}`}
      backLabel="Back to profile"
      profiles={profiles.map((p) => ({
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        bio: p.bio,
      }))}
      searchPlaceholder="Search followers..."
    />
  );
}
