"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireSuperAdmin, type Role } from "@/lib/admin/rbac";
import { revalidatePath } from "next/cache";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Delete rows that use ON DELETE SET NULL, optional tables, and storage before removing auth.users. */
async function purgeUserRelatedData(admin: AdminClient, targetId: string) {
  await admin.from("analytics_events").delete().eq("user_id", targetId);
  await admin.from("recommendation_sessions").delete().eq("user_id", targetId);
  await admin.from("letterboxd_imports").delete().eq("user_id", targetId);

  const { error: friendsErr } = await admin
    .from("friendships")
    .delete()
    .or(`requester_id.eq.${targetId},addressee_id.eq.${targetId}`);
  if (friendsErr) {
    console.warn("[admin] friendships purge:", friendsErr.message);
  }

  await admin.from("role_audit_logs").delete().or(`actor_id.eq.${targetId},target_id.eq.${targetId}`);

  const paths = [`${targetId}/avatar.jpg`, `${targetId}/banner.jpg`, `${targetId}/profile-bg.jpg`];
  const { error: storageErr } = await admin.storage.from("avatars").remove(paths);
  if (storageErr) {
    console.warn("[admin] storage purge:", storageErr.message);
  }
}

// ---------------------------------------------------------------------------
// Helper: regular client for read-only admin queries (relies on super_admin RLS)
// ---------------------------------------------------------------------------
async function readerClient() {
  return createClient();
}

// ---------------------------------------------------------------------------
// Role management
// ---------------------------------------------------------------------------

export async function promoteUser(targetId: string, newRole: Role) {
  // Only super_admin can assign admin / super_admin roles
  const { userId: actorId, role: actorRole } = await requireSuperAdmin();

  if (targetId === actorId) throw new Error("You cannot change your own role.");

  const admin = createAdminClient();

  // Read the target's current role
  const { data: target } = await admin
    .from("profiles")
    .select("role")
    .eq("id", targetId)
    .maybeSingle();

  if (!target) throw new Error("User not found.");

  const oldRole = target.role as Role;

  // Prevent super_admin from being demoted by anyone other than themselves
  if (oldRole === "super_admin" && actorRole !== "super_admin") {
    throw new Error("Only a super_admin can change another super_admin's role.");
  }

  // Update role (service role bypasses the trigger guard intentionally)
  const { error } = await admin
    .from("profiles")
    .update({ role: newRole })
    .eq("id", targetId);

  if (error) throw new Error("Failed to update role: " + error.message);

  // Audit log
  await admin.from("role_audit_logs").insert({
    actor_id: actorId,
    target_id: targetId,
    old_role: oldRole,
    new_role: newRole,
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/logs");
}

// ---------------------------------------------------------------------------
// User status management
// ---------------------------------------------------------------------------

export async function setUserStatus(
  targetId: string,
  status: "active" | "suspended" | "banned",
) {
  const { userId: actorId } = await requireAdmin();
  if (targetId === actorId) throw new Error("You cannot change your own status.");

  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", targetId);

  if (error) throw new Error("Failed to update status: " + error.message);

  await supabase.from("role_audit_logs").insert({
    actor_id: actorId,
    target_id: targetId,
    old_role: null,
    new_role: `status:${status}`,
    notes: `Status changed to ${status}`,
  });

  revalidatePath("/admin/users");
}

// ---------------------------------------------------------------------------
// Delete / disable account
// ---------------------------------------------------------------------------

export async function deleteUserAccount(targetId: string) {
  const { userId: actorId } = await requireSuperAdmin();
  if (targetId === actorId) throw new Error("You cannot delete your own account.");

  const admin = createAdminClient();

  const { data: target, error: fetchErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", targetId)
    .maybeSingle();

  if (fetchErr) throw new Error("Failed to look up user: " + fetchErr.message);
  if (!target) throw new Error("User not found.");

  const oldRole = String(target.role);

  await purgeUserRelatedData(admin, targetId);

  // Remove the auth user — cascades public.profiles and dependent rows (watched_movies, follows, etc.).
  const { error: deleteErr } = await admin.auth.admin.deleteUser(targetId);
  if (deleteErr) throw new Error("Failed to delete account: " + deleteErr.message);

  await admin.from("role_audit_logs").insert({
    actor_id: actorId,
    target_id: null,
    old_role: oldRole,
    new_role: "account_deleted",
    notes: `Permanently deleted auth user ${targetId} at ${new Date().toISOString()}`,
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/logs");
}

// ---------------------------------------------------------------------------
// Update admin notes
// ---------------------------------------------------------------------------

export async function setAdminNotes(targetId: string, notes: string) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ admin_notes: notes.trim() || null })
    .eq("id", targetId);
  revalidatePath("/admin/users");
}

// ---------------------------------------------------------------------------
// Feedback moderation
// ---------------------------------------------------------------------------

export async function deleteFeedback(feedbackId: number) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_feedback")
    .delete()
    .eq("id", feedbackId);
  if (error) throw new Error("Failed to delete feedback.");
  revalidatePath("/admin/feedback");
}

// ---------------------------------------------------------------------------
// Dashboard stats — safe aggregations using service role
// ---------------------------------------------------------------------------

export async function getDashboardStats() {
  await requireAdmin();
  const supabase = await readerClient();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  const [
    { count: totalUsers },
    { count: newToday },
    { count: newThisWeek },
    { count: newThisMonth },
    { count: totalWatched },
    { count: totalWatchlist },
    { count: totalRatings },
    { count: totalFeedback },
    { count: activeThisWeek },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", dayAgo),
    supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
    supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", monthAgo),
    supabase.from("watched_movies").select("*", { count: "exact", head: true }),
    supabase.from("watchlist").select("*", { count: "exact", head: true }),
    supabase.from("watched_movies").select("*", { count: "exact", head: true }).not("user_rating", "is", null),
    supabase.from("app_feedback").select("*", { count: "exact", head: true }),
    supabase.from("watched_movies").select("user_id", { count: "exact", head: true }).gte("watched_at", weekAgo),
  ]);

  return {
    totalUsers: totalUsers ?? 0,
    newToday: newToday ?? 0,
    newThisWeek: newThisWeek ?? 0,
    newThisMonth: newThisMonth ?? 0,
    totalWatched: totalWatched ?? 0,
    totalWatchlist: totalWatchlist ?? 0,
    totalRatings: totalRatings ?? 0,
    totalFeedback: totalFeedback ?? 0,
    activeThisWeek: activeThisWeek ?? 0,
  };
}

export async function getRecentSignups(limit = 8) {
  await requireAdmin();
  const supabase = await readerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, username, email, role, status, created_at, avatar_url")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getRecentActivity(limit = 10) {
  await requireAdmin();
  const supabase = await readerClient();
  const { data } = await supabase
    .from("analytics_events")
    .select("id, event_name, user_id, properties, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getUserGrowthChart(days = 30) {
  await requireAdmin();
  const supabase = await readerClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data } = await supabase
    .from("profiles")
    .select("created_at")
    .gte("created_at", since)
    .order("created_at");

  if (!data) return [];

  // Bucket by day
  const counts: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    counts[key] = 0;
  }
  for (const row of data) {
    const key = (row.created_at as string).slice(0, 10);
    if (key in counts) counts[key]++;
  }

  return Object.entries(counts).map(([date, count]) => ({ date, count }));
}

export async function getEventChart(days = 14) {
  await requireAdmin();
  const supabase = await readerClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data } = await supabase
    .from("analytics_events")
    .select("event_name, created_at")
    .gte("created_at", since);

  if (!data) return { daily: [], topEvents: [] };

  // Daily totals
  const dailyCounts: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    dailyCounts[d.toISOString().slice(0, 10)] = 0;
  }
  // Top events
  const eventCounts: Record<string, number> = {};
  for (const row of data) {
    const day = (row.created_at as string).slice(0, 10);
    if (day in dailyCounts) dailyCounts[day]++;
    eventCounts[row.event_name] = (eventCounts[row.event_name] ?? 0) + 1;
  }

  const daily = Object.entries(dailyCounts).map(([date, count]) => ({ date, count }));
  const topEvents = Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([event, count]) => ({ event, count }));

  return { daily, topEvents };
}

// ---------------------------------------------------------------------------
// Full user list (admin)
// ---------------------------------------------------------------------------

export async function getAllUsers(opts?: {
  search?: string;
  role?: Role | "";
  status?: "active" | "suspended" | "banned" | "";
  limit?: number;
  offset?: number;
}) {
  await requireAdmin();
  const supabase = await readerClient();

  let q = supabase
    .from("profiles")
    .select(
      "id, display_name, username, email, role, status, admin_notes, created_at, last_active_at, avatar_url",
    )
    .order("created_at", { ascending: false });

  if (opts?.search) {
    const s = `%${opts.search}%`;
    q = q.or(`display_name.ilike.${s},username.ilike.${s},email.ilike.${s}`);
  }
  if (opts?.role) q = q.eq("role", opts.role);
  if (opts?.status) q = q.eq("status", opts.status);

  q = q.range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 50) - 1);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getUserDetail(userId: string) {
  const { role: actorRole } = await requireAdmin();
  const supabase = await readerClient();

  const [
    { data: profile },
    { count: watchedCount },
    { count: watchlistCount },
    { count: ratingsCount },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, username, email, role, status, admin_notes, created_at, last_active_at, avatar_url")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("watched_movies").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("watchlist").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("watched_movies").select("*", { count: "exact", head: true }).eq("user_id", userId).not("user_rating", "is", null),
  ]);

  return {
    profile: profile ?? null,
    watchedCount: watchedCount ?? 0,
    watchlistCount: watchlistCount ?? 0,
    ratingsCount: ratingsCount ?? 0,
    canChangeRole: actorRole === "super_admin",
  };
}

export async function getAuditLogs(limit = 50) {
  await requireAdmin();
  const supabase = await readerClient();

  const { data } = await supabase
    .from("role_audit_logs")
    .select("id, actor_id, target_id, old_role, new_role, notes, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

export async function getAllFeedback() {
  await requireAdmin();
  const supabase = await readerClient();
  const { data } = await supabase
    .from("app_feedback")
    .select("id, user_id, rating, body, created_at, profiles(display_name, username, email)")
    .order("created_at", { ascending: false });
  return data ?? [];
}
