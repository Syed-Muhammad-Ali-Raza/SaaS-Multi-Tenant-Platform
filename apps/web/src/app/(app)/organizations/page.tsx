"use client";

import { useMyOrgsQuery, useCreateOrgMutation } from "@/hooks/useOrgQueries";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { useState } from "react";
import { Building2, Plus } from "lucide-react";

export default function OrganizationsPage() {
  const { activeOrgId, setActiveOrg } = useAuthStore();
  const myOrgs = useMyOrgsQuery();
  const createOrg = useCreateOrgMutation();
  const [showCreate, setShowCreate] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    try {
      const result = await createOrg.mutateAsync({ name: newOrgName });
      toast.success("Organization created!");
      setNewOrgName("");
      setShowCreate(false);
      if (result.membership?.organizationId) {
        setActiveOrg(result.membership.organizationId);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-muted-foreground">Manage your organizations</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Organization
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="flex gap-3 rounded-lg border p-4">
          <input
            type="text"
            placeholder="Organization name"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            required
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={createOrg.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createOrg.isPending ? "Creating..." : "Create"}
          </button>
        </form>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {myOrgs.data?.map((m) => (
          <button
            key={m.organizationId}
            onClick={() => setActiveOrg(m.organizationId)}
            className={`rounded-lg border p-6 text-left transition-colors hover:bg-accent ${
              m.organizationId === activeOrgId
                ? "border-primary ring-1 ring-primary"
                : ""
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">{m.organization.name}</h3>
                <p className="text-sm text-muted-foreground">{m.organization.slug}</p>
              </div>
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                {m.role.replace("_", " ")}
              </span>
              <span className="text-xs text-muted-foreground">Plan: {m.organization.plan}</span>
            </div>
          </button>
        ))}
        {myOrgs.isLoading && (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        )}
        {myOrgs.data?.length === 0 && !myOrgs.isLoading && (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
            You don&apos;t belong to any organizations yet.
          </div>
        )}
      </div>
    </div>
  );
}