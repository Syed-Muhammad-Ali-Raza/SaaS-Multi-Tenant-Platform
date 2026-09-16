import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { RegisterInput, LoginInput, Role } from "saas-shared";
import type { AuthResponse, User, Membership } from "@/types";

export function useLoginMutation() {
  const queryClient = useQueryClient();
  const { setAuth } = useAuthStore();

  return useMutation({
    mutationFn: async (data: LoginInput) => {
      const res = await api.post<AuthResponse>("/api/auth/login", data);
      return res.data;
    },
    onSuccess: (data) => {
      setAuth({
        user: data.user,
        accessToken: data.accessToken,
        memberships: data.memberships,
        activeOrgId: data.activeOrg?.id,
      });
      queryClient.invalidateQueries();
    },
  });
}

export function useRegisterMutation() {
  const queryClient = useQueryClient();
  const { setAuth } = useAuthStore();

  return useMutation({
    mutationFn: async (data: RegisterInput) => {
      const res = await api.post<AuthResponse>("/api/auth/register", data);
      return res.data;
    },
    onSuccess: (data) => {
      setAuth({
        user: data.user,
        accessToken: data.accessToken,
        memberships: data.memberships,
        activeOrgId: data.activeOrg?.id,
      });
      queryClient.invalidateQueries();
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  const { logout } = useAuthStore();

  return useMutation({
    mutationFn: async () => {
      await api.post("/api/auth/logout");
    },
    onSettled: () => {
      logout();
      queryClient.clear();
    },
  });
}

export function useSwitchOrgMutation() {
  const queryClient = useQueryClient();
  const { setActiveOrg } = useAuthStore();

  return useMutation({
    mutationFn: async (organizationId: string) => {
      const res = await api.post<{
        accessToken: string;
        organization: { id: string; name: string; slug: string };
      }>("/api/auth/switch-org", { organizationId });
      return res.data;
    },
    onSuccess: (data) => {
      useAuthStore.getState().setAccessToken(data.accessToken);
      setActiveOrg(data.organization.id);
      queryClient.invalidateQueries();
    },
  });
}

export type { User, Membership, Role };