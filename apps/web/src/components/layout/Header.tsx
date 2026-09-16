"use client";

import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useLogoutMutation, useSwitchOrgMutation } from "@/hooks/useAuthMutations";
import { LogOut, ChevronDown, Building2, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { usePermission } from "@/hooks/usePermission";

export function Header() {
  const { user, memberships, activeOrgId } = useAuthStore();
  const switchOrg = useSwitchOrgMutation();
  const logout = useLogoutMutation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const { isSuperAdmin } = usePermission();

  async function handleSwitchOrg(orgId: string) {
    await switchOrg.mutateAsync(orgId);
    setOrgMenuOpen(false);
  }

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-lg font-bold">
            SaaS Platform
          </Link>

          {/* Org Switcher */}
          <div className="relative">
            <button
              onClick={() => setOrgMenuOpen(!orgMenuOpen)}
              className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              <Building2 className="h-4 w-4" />
              {memberships.find((m) => m.organizationId === activeOrgId)?.organization.name ?? "Select organization"}
              <ChevronDown className="h-4 w-4" />
            </button>

            {orgMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOrgMenuOpen(false)} />
                <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border bg-popover p-1 shadow-md">
                  {memberships.map((m) => (
                    <button
                      key={m.organizationId}
                      onClick={() => handleSwitchOrg(m.organizationId)}
                      className={`flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent ${
                        m.organizationId === activeOrgId ? "bg-accent font-medium" : ""
                      }`}
                    >
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span className="truncate">{m.organization.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/profile" className="text-sm text-muted-foreground hover:text-foreground">
            Profile
          </Link>
          {isSuperAdmin && (
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
              Admin
            </Link>
          )}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
              </div>
              <ChevronDown className="h-4 w-4" />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border bg-popover p-1 shadow-md">
                  <div className="px-3 py-2 text-sm">
                    <div className="font-medium">{user?.name}</div>
                    <div className="text-muted-foreground">{user?.email}</div>
                  </div>
                  <div className="my-1 h-px bg-border" />
                  <Link
                    href="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
                  >
                    <UserIcon className="h-4 w-4" /> Profile
                  </Link>
                  <button
                    onClick={() => {
                      logout.mutate();
                      setUserMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-destructive hover:bg-accent"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}