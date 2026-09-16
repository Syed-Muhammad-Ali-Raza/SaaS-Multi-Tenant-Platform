"use client";

import { useAdminOrgsQuery, useAdminUsersQuery, useAdminAuditLogsQuery } from "@/hooks/useAdminQueries";
import { usePermission } from "@/hooks/usePermission";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminPage() {
  const router = useRouter();
  const { isSuperAdmin, canAccessAdmin } = usePermission();

  useEffect(() => {
    if (canAccessAdmin()) return;
    router.replace("/dashboard");
  }, [canAccessAdmin, router]);

  if (!canAccessAdmin()) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Platform management for super admins</p>
      </div>
      <AdminOrgs />
      <AdminUsers />
      <AdminAuditLogs />
    </div>
  );
}

function AdminOrgs() {
  const { data, isLoading } = useAdminOrgsQuery();

  return (
    <div className="rounded-lg border">
      <div className="border-b px-4 py-3">
        <h2 className="font-medium">Organizations ({data?.total ?? 0})</h2>
      </div>
      <div className="divide-y">
        {data?.items.map((org) => (
          <div key={org.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{org.name}</p>
              <p className="text-sm text-muted-foreground">Slug: {org.slug}</p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>{org._count.memberships} members</p>
              <p>Plan: {org.plan}</p>
            </div>
          </div>
        ))}
        {isLoading && <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading...</div>}
        {data?.items.length === 0 && <div className="px-4 py-6 text-center text-sm text-muted-foreground">No organizations</div>}
      </div>
    </div>
  );
}

function AdminUsers() {
  const { data, isLoading } = useAdminUsersQuery();

  return (
    <div className="rounded-lg border">
      <div className="border-b px-4 py-3">
        <h2 className="font-medium">Users ({data?.total ?? 0})</h2>
      </div>
      <div className="divide-y">
        {data?.items.map((user) => (
          <div key={user.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              {user.isSuperAdmin && (
                <span className="mr-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Super Admin</span>
              )}
              <span>{user._count.memberships} orgs</span>
            </div>
          </div>
        ))}
        {isLoading && <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading...</div>}
        {data?.items.length === 0 && <div className="px-4 py-6 text-center text-sm text-muted-foreground">No users</div>}
      </div>
    </div>
  );
}

function AdminAuditLogs() {
  const { data, isLoading } = useAdminAuditLogsQuery();

  return (
    <div className="rounded-lg border">
      <div className="border-b px-4 py-3">
        <h2 className="font-medium">Audit Logs ({data?.total ?? 0})</h2>
      </div>
      <div className="divide-y">
        {data?.items.map((log) => (
          <div key={log.id} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{log.action}</span>
              <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {log.actor?.email && <span>by {log.actor.email} </span>}
              {log.organization?.name && <span>in {log.organization.name} </span>}
              {log.ipAddress && <span>from {log.ipAddress}</span>}
            </div>
          </div>
        ))}
        {isLoading && <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading...</div>}
        {data?.items.length === 0 && <div className="px-4 py-6 text-center text-sm text-muted-foreground">No audit logs</div>}
      </div>
    </div>
  );
}