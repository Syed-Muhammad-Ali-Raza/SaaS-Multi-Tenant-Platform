import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Role } from "saas-shared";
import type { User, Membership } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  memberships: Membership[];
  activeOrgId: string | null;
  isBootstrapped: boolean;
  setAuth: (payload: {
    user: User;
    accessToken: string;
    memberships: Membership[];
    activeOrgId?: string | null;
  }) => void;
  setAccessToken: (token: string) => void;
  setActiveOrg: (orgId: string) => void;
  setMemberships: (memberships: Membership[]) => void;
  setUser: (user: User) => void;
  setBootstrapped: (value: boolean) => void;
  logout: () => void;
  hasRole: (role: Role) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      memberships: [],
      activeOrgId: null,
      isBootstrapped: false,
      setAuth: ({ user, accessToken, memberships, activeOrgId }) =>
        set({
          user,
          accessToken,
          memberships,
          activeOrgId: activeOrgId ?? get().activeOrgId ?? memberships[0]?.organizationId ?? null,
        }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setActiveOrg: (activeOrgId) => set({ activeOrgId }),
      setMemberships: (memberships) => set({ memberships }),
      setUser: (user) => set({ user }),
      setBootstrapped: (isBootstrapped) => set({ isBootstrapped }),
      logout: () =>
        set({
          user: null,
          accessToken: null,
          memberships: [],
          activeOrgId: null,
          isBootstrapped: true,
        }),
      hasRole: (role) => {
        const { user, memberships, activeOrgId } = get();
        if (user?.isSuperAdmin) {
          return true;
        }
        const active = memberships.find(
          (m) => m.organizationId === activeOrgId
        );
        if (!active) {
          return false;
        }
        if (active.role === Role.SUPER_ADMIN) {
          return true;
        }
        return active.role === role;
      },
    }),
    {
      name: "saas-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        activeOrgId: state.activeOrgId,
      }),
    }
  )
);