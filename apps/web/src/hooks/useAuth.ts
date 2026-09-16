import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";

export function useAuth() {
  const { user, accessToken, isBootstrapped, memberships, activeOrgId } =
    useAuthStore();

  const isAuthenticated = !!user && !!accessToken;
  const activeOrg = memberships.find(
    (m) => m.organizationId === activeOrgId
  );

  return {
    user,
    isAuthenticated,
    isBootstrapped,
    memberships,
    activeOrgId,
    activeOrg: activeOrg ?? null,
  };
}

export function useRequireAuth() {
  const router = useRouter();
  const { isAuthenticated, isBootstrapped } = useAuth();

  useEffect(() => {
    if (isBootstrapped && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isBootstrapped, isAuthenticated, router]);

  return { isAuthenticated, isBootstrapped };
}