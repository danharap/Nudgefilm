import { FollowListView } from "@/components/social/FollowListView";
import { getFollowing, getProfileByUsername } from "@/features/users/service";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function UserFollowingPage({
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
    redirect("/profile/following");
  }

  const profiles = await getFollowing(target.id);
  const slug = target.username ?? username;

  return (
    <FollowListView
      title="Following"
      backHref={`/user/${encodeURIComponent(slug)}`}
      backLabel="Back to profile"
      profiles={profiles.map((p) => ({
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        bio: p.bio,
      }))}
      searchPlaceholder="Search following..."
    />
  );
}
