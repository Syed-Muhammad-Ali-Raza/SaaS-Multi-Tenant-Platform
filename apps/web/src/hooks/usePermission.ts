import { Role } from "saas-shared";
import { useAuthStore } from "@/stores/authStore";

export function usePermission() {
  const { hasRole, user } = useAuthStore();

  const isSuperAdmin = !!user?.isSuperAdmin;

  function can(role: Role): boolean {
    return hasRole(role);
  }

  function canAccessAdmin(): boolean {
    return isSuperAdmin;
  }

  return { can, canAccessAdmin, isSuperAdmin };
}