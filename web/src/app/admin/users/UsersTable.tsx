"use client";

import { deleteUserAccount, promoteUser, setAdminNotes, setUserStatus } from "@/app/actions/admin";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setSelectedUser, setUserFilter } from "@/store/slices/adminSlice";
import { clearToast, showToast } from "@/store/slices/uiSlice";
import { useEffect, useTransition, useState } from "react";
import type { Role } from "@/lib/admin/rbac";

type User = {
  id: string;
  display_name: string | null;
  username: string | null;
  email: string | null;
  role: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  last_active_at: string | null;
  avatar_url: string | null;
  heard_from: string | null;
};

const HEARD_FROM_LABELS: Record<string, string> = {
  friend: "Friend",
  social: "Social",
  search: "Online",
  other: "Other",
};

const ROLE_OPTIONS: Role[] = ["user", "moderator", "admin", "super_admin"];
const STATUS_OPTIONS = ["active", "suspended", "banned"] as const;

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-purple-900/40 text-purple-300",
  admin: "bg-indigo-900/40 text-indigo-300",
  moderator: "bg-blue-900/40 text-blue-300",
  user: "bg-zinc-800 text-zinc-400",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-900/30 text-green-400",
  suspended: "bg-yellow-900/30 text-yellow-400",
  banned: "bg-red-900/30 text-red-400",
};

function UserRow({
  user,
  canChangeRole,
  isSelected,
  onSelect,
}: {
  user: User;
  canChangeRole: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const dispatch = useAppDispatch();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(user.admin_notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);

  async function handleRoleChange(newRole: Role) {
    if (!confirm(`Change ${user.display_name ?? user.email}'s role to ${newRole}?`)) return;
    startTransition(async () => {
      try {
        await promoteUser(user.id, newRole);
        dispatch(showToast({ message: "Role updated.", type: "success" }));
      } catch (e) {
        dispatch(showToast({ message: (e as Error).message, type: "error" }));
      }
    });
  }

  async function handleStatusChange(status: "active" | "suspended" | "banned") {
    if (!confirm(`Set ${user.display_name ?? user.email}'s status to ${status}?`)) return;
    startTransition(async () => {
      try {
        await setUserStatus(user.id, status);
        dispatch(showToast({ message: "Status updated.", type: "success" }));
      } catch (e) {
        dispatch(showToast({ message: (e as Error).message, type: "error" }));
      }
    });
  }

  async function handleDelete() {
    if (!confirm(`Permanently delete ${user.display_name ?? user.email}? This cannot be undone.`)) return;
    try {
      await deleteUserAccount(user.id);
      dispatch(setSelectedUser(null));
      dispatch(showToast({ message: "Account deleted.", type: "success" }));
    } catch (e) {
      dispatch(showToast({ message: (e as Error).message, type: "error" }));
    }
  }

  async function handleSaveNotes() {
    startTransition(async () => {
      await setAdminNotes(user.id, notes);
      setEditingNotes(false);
      dispatch(showToast({ message: "Notes saved.", type: "success" }));
    });
  }

  return (
    <>
      <tr
        className={`cursor-pointer border-b border-white/5 transition hover:bg-white/[0.02] ${isSelected ? "bg-indigo-400/5" : ""} ${isPending ? "opacity-60" : ""}`}
        onClick={onSelect}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-bold text-indigo-300">
              {((user.display_name ?? user.email) ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {user.display_name ?? <span className="text-zinc-500">—</span>}
              </p>
              <p className="text-xs text-zinc-500">
                @{user.username ?? "—"} · {user.email ?? "—"}
              </p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_COLORS[user.role] ?? ROLE_COLORS.user}`}>
            {user.role}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[user.status] ?? STATUS_COLORS.active}`}>
            {user.status}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-zinc-500">
          {new Date(user.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </td>
        <td className="px-4 py-3 text-xs text-zinc-400">
          {user.heard_from ? HEARD_FROM_LABELS[user.heard_from] ?? user.heard_from : "—"}
        </td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5">
            {canChangeRole && (
              <select
                value={user.role}
                disabled={isPending}
                onChange={(e) => handleRoleChange(e.target.value as Role)}
                className="rounded-lg border border-white/10 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 focus:outline-none"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            )}
            <select
              value={user.status}
              disabled={isPending}
              onChange={(e) => handleStatusChange(e.target.value as "active" | "suspended" | "banned")}
              className="rounded-lg border border-white/10 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 focus:outline-none"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {canChangeRole && (
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-900/20"
              >
                Delete
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded row: notes */}
      {isSelected && (
        <tr className="border-b border-white/5 bg-zinc-900/60">
          <td colSpan={6} className="px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="mb-1.5 text-xs font-medium text-zinc-400">Admin notes</p>
                {editingNotes ? (
                  <div className="flex gap-2">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="flex-1 resize-none rounded-xl border border-white/10 bg-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
                      placeholder="Internal notes (not visible to user)…"
                    />
                    <div className="flex flex-col gap-1.5">
                      <button onClick={handleSaveNotes} className="rounded-full bg-indigo-500 px-3 py-1 text-[10px] font-semibold text-white hover:bg-indigo-400">Save</button>
                      <button onClick={() => { setEditingNotes(false); setNotes(user.admin_notes ?? ""); }} className="rounded-full border border-white/10 px-3 py-1 text-[10px] text-zinc-400">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p
                    onClick={() => setEditingNotes(true)}
                    className="cursor-pointer rounded-xl border border-dashed border-white/10 px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    {notes || "Click to add notes…"}
                  </p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
const ADMIN_TOAST_AUTO_DISMISS_MS = 4500;

function AdminToast() {
  const dispatch = useAppDispatch();
  const { toastMessage, toastType } = useAppSelector((s) => s.ui);

  useEffect(() => {
    if (!toastMessage) return;
    const id = window.setTimeout(() => dispatch(clearToast()), ADMIN_TOAST_AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [toastMessage, dispatch]);

  if (!toastMessage) return null;
  return (
    <div
      role="status"
      className={`fixed bottom-6 right-6 z-50 cursor-pointer rounded-2xl px-4 py-3 text-sm font-medium shadow-xl ${
        toastType === "success"
          ? "bg-green-900 text-green-200"
          : toastType === "error"
            ? "bg-red-900 text-red-200"
            : "bg-zinc-800 text-zinc-200"
      }`}
      onClick={() => dispatch(clearToast())}
    >
      {toastMessage}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main table
// ---------------------------------------------------------------------------
export function UsersTable({
  initialUsers,
  canChangeRole,
}: {
  initialUsers: User[];
  canChangeRole: boolean;
}) {
  const dispatch = useAppDispatch();
  const filter = useAppSelector((s) => s.admin.userFilter);
  const selectedId = useAppSelector((s) => s.admin.selectedUserId);

  const filtered = initialUsers.filter((u) => {
    if (
      filter.search &&
      !`${u.display_name ?? ""} ${u.username ?? ""} ${u.email ?? ""}`
        .toLowerCase()
        .includes(filter.search.toLowerCase())
    )
      return false;
    if (filter.role && u.role !== filter.role) return false;
    if (filter.status && u.status !== filter.status) return false;
    return true;
  });

  return (
    <>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={filter.search}
          onChange={(e) => dispatch(setUserFilter({ search: e.target.value }))}
          placeholder="Search name, username, email…"
          className="w-64 rounded-xl border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
        />
        <select
          value={filter.role}
          onChange={(e) => dispatch(setUserFilter({ role: e.target.value }))}
          className="rounded-xl border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 focus:outline-none"
        >
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={filter.status}
          onChange={(e) => dispatch(setUserFilter({ status: e.target.value }))}
          className="rounded-xl border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 focus:outline-none"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="ml-auto text-xs text-zinc-500">
          {filtered.length} user{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/8">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-white/8 bg-zinc-900/60">
              {["User", "Role", "Status", "Joined", "Heard from", "Actions"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-xs font-semibold text-zinc-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-500">
                  No users match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  canChangeRole={canChangeRole}
                  isSelected={selectedId === u.id}
                  onSelect={() =>
                    dispatch(setSelectedUser(selectedId === u.id ? null : u.id))
                  }
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminToast />
    </>
  );
}
