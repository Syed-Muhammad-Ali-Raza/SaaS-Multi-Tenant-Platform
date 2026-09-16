"use client";

import { useAuthStore } from "@/stores/authStore";

export default function DashboardPage() {
  const { user, activeOrgId, memberships } = useAuthStore();
  const activeOrg = memberships.find((m) => m.organizationId === activeOrgId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.name}. You&apos;re in <strong>{activeOrg?.organization.name ?? "no organization"}</strong>.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border p-6">
          <h2 className="text-sm font-medium text-muted-foreground">Organization</h2>
          <p className="mt-2 text-2xl font-semibold">{activeOrg?.organization.name ?? "—"}</p>
          <p className="text-sm text-muted-foreground">Slug: {activeOrg?.organization.slug ?? "—"}</p>
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="text-sm font-medium text-muted-foreground">Your Role</h2>
          <p className="mt-2 text-2xl font-semibold">{activeOrg?.role?.replace("_", " ") ?? "—"}</p>
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="text-sm font-medium text-muted-foreground">Organizations</h2>
          <p className="mt-2 text-2xl font-semibold">{memberships.length}</p>
          <p className="text-sm text-muted-foreground">you belong to</p>
        </div>
      </div>
    </div>
  );
}