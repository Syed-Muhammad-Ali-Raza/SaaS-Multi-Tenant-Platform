import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { Role } from "saas-shared";
import type { Membership, Invitation, Organization } from "@/types";

export function useMyOrgsQuery() {
  return useQuery({
    queryKey: ["orgs"],
    queryFn: async () => {
      const res = await api.get<Membership[]>("/api/orgs");
      return res.data;
    },
  });
}

export function useOrgQuery(orgId: string) {
  return useQuery({
    queryKey: ["orgs", orgId],
    queryFn: async () => {
      const res = await api.get<Organization>(`/api/orgs/${orgId}`);
      return res.data;
    },
    enabled: !!orgId,
  });
}

export function useOrgMembersQuery(orgId: string) {
  return useQuery({
    queryKey: ["orgs", orgId, "members"],
    queryFn: async () => {
      const res = await api.get<Membership[]>(`/api/orgs/${orgId}/members`);
      return res.data;
    },
    enabled: !!orgId,
  });
}

export function useOrgInvitationsQuery(orgId: string) {
  return useQuery({
    queryKey: ["orgs", orgId, "invitations"],
    queryFn: async () => {
      const res = await api.get<Invitation[]>(
        `/api/orgs/${orgId}/invitations`
      );
      return res.data;
    },
    enabled: !!orgId,
  });
}

export function useCreateOrgMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await api.post<{ organization: Organization; membership: Membership }>(
        "/api/orgs",
        data
      );
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orgs"] }),
  });
}

export function useUpdateOrgMutation(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name?: string; logoUrl?: string | null }) => {
      const res = await api.patch(`/api/orgs/${orgId}`, data);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orgs"] }),
  });
}

export function useInviteMemberMutation(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { email: string; role: Role }) => {
      const res = await api.post(`/api/orgs/${orgId}/invitations`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgs", orgId, "invitations"] });
    },
  });
}

export function useRemoveMemberMutation(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await api.delete(`/api/orgs/${orgId}/members/${userId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgs", orgId, "members"] });
    },
  });
}

export function useUpdateMemberRoleMutation(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { userId: string; role: Role }) => {
      const res = await api.patch(
        `/api/orgs/${orgId}/members/${data.userId}`,
        { role: data.role }
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgs", orgId, "members"] });
    },
  });
}

export function useActiveOrgQuery() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  return useOrgQuery(activeOrgId ?? "");
}