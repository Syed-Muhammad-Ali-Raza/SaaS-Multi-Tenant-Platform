"use client";

import { useState } from "react";
import { Role } from "saas-shared";
import { useAuthStore } from "@/stores/authStore";
import {
  useOrgMembersQuery,
  useOrgInvitationsQuery,
  useInviteMemberMutation,
  useRemoveMemberMutation,
} from "@/hooks/useOrgQueries";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { usePermission } from "@/hooks/usePermission";
import { UserPlus, Trash2 } from "lucide-react";

export default function MembersPage() {
  const { activeOrgId } = useAuthStore();
  const { can } = usePermission();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>(Role.ORG_USER);

  const members = useOrgMembersQuery(activeOrgId ?? "");
  const invitations = useOrgInvitationsQuery(activeOrgId ?? "");
  const inviteMutation = useInviteMemberMutation(activeOrgId ?? "");
  const removeMutation = useRemoveMemberMutation(activeOrgId ?? "");

  const isAdmin = can(Role.ORG_ADMIN);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    try {
      await inviteMutation.mutateAsync({ email: inviteEmail, role: inviteRole });
      toast.success("Invitation sent!");
      setInviteEmail("");
      setShowInvite(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function handleRemove(userId: string) {
    if (!confirm("Remove this member? They will be signed out immediately.")) return;
    try {
      await removeMutation.mutateAsync(userId);
      toast.success("Member removed");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="text-muted-foreground">Manage your organization members</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <UserPlus className="h-4 w-4" />
            Invite Member
          </button>
        )}
      </div>

      {showInvite && (
        <form onSubmit={handleInvite} className="flex gap-3 rounded-lg border p-4">
          <input
            type="email"
            placeholder="Email address"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as Role)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value={Role.ORG_USER}>User</option>
            <option value={Role.MEMBER}>Member (read-only)</option>
            <option value={Role.ORG_ADMIN}>Admin</option>
          </select>
          <button
            type="submit"
            disabled={inviteMutation.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {inviteMutation.isPending ? "Sending..." : "Send"}
          </button>
        </form>
      )}

      {/* Active Members */}
      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <h2 className="font-medium">Active Members ({members.data?.length ?? 0})</h2>
        </div>
        <div className="divide-y">
          {members.data?.map((m) => {
            const memberUser = m.user;
            return (
              <div key={m.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{memberUser?.name ?? "Unknown"}</p>
                  <p className="text-sm text-muted-foreground">{memberUser?.email ?? "—"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                    {m.role.replace("_", " ")}
                  </span>
                  {isAdmin && memberUser && memberUser.id !== useAuthStore.getState().user?.id && (
                    <button
                      onClick={() => handleRemove(memberUser.id)}
                      className="text-destructive hover:text-destructive/80"
                      title="Remove member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {members.isLoading && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading...</div>
          )}
          {members.data?.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">No members</div>
          )}
        </div>
      </div>

      {/* Pending Invitations */}
      {isAdmin && invitations.data && invitations.data.length > 0 && (
        <div className="rounded-lg border">
          <div className="border-b px-4 py-3">
            <h2 className="font-medium">Pending Invitations ({invitations.data.length})</h2>
          </div>
          <div className="divide-y">
            {invitations.data.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{inv.email}</p>
                  <p className="text-sm text-muted-foreground">
                    Invited by {inv.invitedBy.name}
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                  {inv.role.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}