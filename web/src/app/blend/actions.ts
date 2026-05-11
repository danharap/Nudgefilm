"use server";

import { createClient } from "@/lib/supabase/server";
import { getBlendPartyRecommendations, type GroupBlendResult } from "@/features/recommendations/groupBlend";
import { revalidatePath } from "next/cache";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PartyMember = {
  user_id: string;
  role: string;
  joined_at: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type BlendPartyData = {
  id: string;
  creator_id: string;
  token: string;
  title: string | null;
  status: string;
  max_participants: number;
  created_at: string;
  expires_at: string;
  generated_at: string | null;
  members: PartyMember[];
};

export type CreatePartyResult =
  | { ok: true; token: string; partyId: string }
  | { ok: false; error: string };

export type JoinPartyResult =
  | { ok: true; partyId: string }
  | { ok: false; error: string };

export type PartyResult =
  | { ok: true; party: BlendPartyData }
  | { ok: false; error: string };

export type GenerateResult =
  | ({ ok: true } & GroupBlendResult)
  | { ok: false; error: string };

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Create a new Blend Party.
 * The creator is automatically added as a member with role = 'creator'.
 */
export async function createBlendParty(title?: string): Promise<CreatePartyResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "You must be signed in to create a Blend Party." };
    }

    // Create the party
    const { data: party, error: partyError } = await supabase
      .from("blend_parties")
      .insert({
        creator_id: user.id,
        title: title?.trim() || null,
        status: "active",
        max_participants: 5,
      })
      .select("id, token")
      .single();

    if (partyError || !party) {
      console.error("[blend/actions] createBlendParty:", partyError);
      return { ok: false, error: "Failed to create party. Please try again." };
    }

    // Auto-join creator
    const { error: memberError } = await supabase
      .from("blend_party_members")
      .insert({ party_id: party.id, user_id: user.id, role: "creator" });

    if (memberError) {
      console.error("[blend/actions] createBlendParty join:", memberError);
      // Clean up the orphaned party
      await supabase.from("blend_parties").delete().eq("id", party.id);
      return { ok: false, error: "Failed to join your own party. Please try again." };
    }

    return { ok: true, token: party.token as string, partyId: party.id as string };
  } catch (e) {
    console.error("[blend/actions] createBlendParty:", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

// ─── Join ─────────────────────────────────────────────────────────────────────

/**
 * Join a Blend Party by its invite token.
 * Guards: active status, not full, not already a member, not expired.
 */
export async function joinBlendParty(token: string): Promise<JoinPartyResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "You must be signed in to join a Blend Party." };
    }

    // Look up party
    const { data: party } = await supabase
      .from("blend_parties")
      .select("id, status, max_participants, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!party) {
      return { ok: false, error: "Invalid or expired party link." };
    }

    if (party.status !== "active") {
      return { ok: false, error: "This party has ended." };
    }

    if (new Date(party.expires_at as string) < new Date()) {
      // Mark as expired
      await supabase
        .from("blend_parties")
        .update({ status: "expired" })
        .eq("id", party.id);
      return { ok: false, error: "This invite link has expired." };
    }

    // Check current member count
    const { count } = await supabase
      .from("blend_party_members")
      .select("*", { count: "exact", head: true })
      .eq("party_id", party.id);

    if ((count ?? 0) >= (party.max_participants as number)) {
      return { ok: false, error: "This party is full (5 people max)." };
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from("blend_party_members")
      .select("user_id")
      .eq("party_id", party.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      // Already in the party — just return success
      return { ok: true, partyId: party.id as string };
    }

    // Insert membership
    const { error: joinError } = await supabase
      .from("blend_party_members")
      .insert({ party_id: party.id, user_id: user.id, role: "participant" });

    if (joinError) {
      console.error("[blend/actions] joinBlendParty:", joinError);
      return { ok: false, error: "Failed to join the party. Please try again." };
    }

    revalidatePath(`/blend/${token}`);
    return { ok: true, partyId: party.id as string };
  } catch (e) {
    console.error("[blend/actions] joinBlendParty:", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

// ─── Leave ────────────────────────────────────────────────────────────────────

/**
 * Leave a Blend Party.
 * Creator cannot leave (they must close the party instead).
 */
export async function leaveBlendParty(partyId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { ok: false, error: "Not signed in." };

    // Check role
    const { data: member } = await supabase
      .from("blend_party_members")
      .select("role")
      .eq("party_id", partyId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member) return { ok: false, error: "You are not in this party." };
    if (member.role === "creator") {
      return { ok: false, error: "As the creator, use Close Party instead of leaving." };
    }

    await supabase
      .from("blend_party_members")
      .delete()
      .eq("party_id", partyId)
      .eq("user_id", user.id);

    return { ok: true };
  } catch (e) {
    console.error("[blend/actions] leaveBlendParty:", e);
    return { ok: false, error: "Something went wrong." };
  }
}

// ─── Close ────────────────────────────────────────────────────────────────────

/**
 * Creator closes the party (sets status = 'expired').
 */
export async function closeBlendParty(partyId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { ok: false, error: "Not signed in." };

    const { error } = await supabase
      .from("blend_parties")
      .update({ status: "expired" })
      .eq("id", partyId)
      .eq("creator_id", user.id);

    if (error) return { ok: false, error: "Could not close the party." };
    return { ok: true };
  } catch (e) {
    console.error("[blend/actions] closeBlendParty:", e);
    return { ok: false, error: "Something went wrong." };
  }
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Fetch full party data by token (party info + members + profiles).
 */
export async function getPartyByToken(token: string): Promise<PartyResult> {
  try {
    const supabase = await createClient();

    const { data: party } = await supabase
      .from("blend_parties")
      .select("id, creator_id, token, title, status, max_participants, created_at, expires_at, generated_at")
      .eq("token", token)
      .maybeSingle();

    if (!party) {
      return { ok: false, error: "Party not found." };
    }

    // Fetch members + their profiles
    const { data: memberRows } = await supabase
      .from("blend_party_members")
      .select("user_id, role, joined_at")
      .eq("party_id", party.id);

    const memberIds = (memberRows ?? []).map((m) => m.user_id as string);

    let profileMap = new Map<string, { display_name: string | null; username: string | null; avatar_url: string | null }>();
    if (memberIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", memberIds);
      for (const p of profiles ?? []) {
        profileMap.set(p.id as string, {
          display_name: p.display_name as string | null,
          username: p.username as string | null,
          avatar_url: p.avatar_url as string | null,
        });
      }
    }

    const members: PartyMember[] = (memberRows ?? []).map((m) => {
      const prof = profileMap.get(m.user_id as string);
      return {
        user_id: m.user_id as string,
        role: m.role as string,
        joined_at: m.joined_at as string,
        display_name: prof?.display_name ?? null,
        username: prof?.username ?? null,
        avatar_url: prof?.avatar_url ?? null,
      };
    });

    return {
      ok: true,
      party: {
        id: party.id as string,
        creator_id: party.creator_id as string,
        token: party.token as string,
        title: party.title as string | null,
        status: party.status as string,
        max_participants: party.max_participants as number,
        created_at: party.created_at as string,
        expires_at: party.expires_at as string,
        generated_at: party.generated_at as string | null,
        members,
      },
    };
  } catch (e) {
    console.error("[blend/actions] getPartyByToken:", e);
    return { ok: false, error: "Something went wrong." };
  }
}

// ─── Generate recommendations ─────────────────────────────────────────────────

/**
 * Run the group blend algorithm for a party.
 * Requires at least 2 participants and the party must be active.
 */
export async function generatePartyRecommendations(
  partyId: string,
): Promise<GenerateResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "You must be signed in." };
    }

    // Verify user is a member
    const { data: member } = await supabase
      .from("blend_party_members")
      .select("user_id")
      .eq("party_id", partyId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member) {
      return { ok: false, error: "You are not a member of this party." };
    }

    const result = await getBlendPartyRecommendations(partyId);

    if (result.insufficientData) {
      return {
        ok: false,
        error: "Not enough watch history yet. The group needs more logged films to generate picks.",
      };
    }

    if (result.movies.length === 0) {
      return {
        ok: false,
        error: "Couldn't find strong matches for the group's taste right now. Try adding more films to your diaries.",
      };
    }

    // Mark party as having generated picks
    await supabase
      .from("blend_parties")
      .update({ generated_at: new Date().toISOString() })
      .eq("id", partyId);

    return { ok: true, ...result };
  } catch (e) {
    console.error("[blend/actions] generatePartyRecommendations:", e);
    return { ok: false, error: "Something went wrong generating picks. Please try again." };
  }
}
