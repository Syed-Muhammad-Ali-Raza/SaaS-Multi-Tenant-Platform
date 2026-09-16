import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function useAdminOrgsQuery(page = 1) {
  return useQuery({
    queryKey: ["admin", "organizations", page],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<{ id: string; name: string; slug: string; plan: string; createdAt: string; _count: { memberships: number; invitations: number } }>>(
        `/api/admin/organizations?page=${page}`
      );
      return res.data;
    },
  });
}

export function useAdminUsersQuery(page = 1) {
  return useQuery({
    queryKey: ["admin", "users", page],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<{ id: string; email: string; name: string; isSuperAdmin: boolean; createdAt: string; _count: { memberships: number } }>>(
        `/api/admin/users?page=${page}`
      );
      return res.data;
    },
  });
}

export function useAdminAuditLogsQuery(page = 1) {
  return useQuery({
    queryKey: ["admin", "audit-logs", page],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<{ id: string; action: string; metadata: unknown; ipAddress: string; createdAt: string; actor: { id: string; email: string; name: string } | null; organization: { id: string; name: string; slug: string } | null }>>(
        `/api/admin/audit-logs?page=${page}`
      );
      return res.data;
    },
  });
}