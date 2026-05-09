import { FollowListView } from "@/components/social/FollowListView";
import { getFollowing } from "@/features/users/service";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProfileFollowingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/profile/following");

  const profiles = await getFollowing(user.id);

  return (
    <FollowListView
      title="Following"
      backHref="/profile"
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
