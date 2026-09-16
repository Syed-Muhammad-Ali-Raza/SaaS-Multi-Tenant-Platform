import { useEffect } from "react";
import axios from "axios";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/lib/api";

export function useBootstrap() {
  const { isBootstrapped } = useAuthStore();

  useEffect(() => {
    if (isBootstrapped) return;

    let cancelled = false;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

    async function bootstrap() {
      const { accessToken, setAuth, setBootstrapped, logout } =
        useAuthStore.getState();

      try {
        if (accessToken) {
          const res = await api.get<{
            user: Parameters<typeof setAuth>[0]["user"];
            memberships: Parameters<typeof setAuth>[0]["memberships"];
          }>("/api/auth/me");
          if (!cancelled) {
            setAuth({
              user: res.data.user,
              accessToken,
              memberships: res.data.memberships,
            });
          }
        } else {
          const res = await axios.post<{
            accessToken: string;
            user: Parameters<typeof setAuth>[0]["user"];
            memberships: Parameters<typeof setAuth>[0]["memberships"];
            activeOrg: { id: string } | null;
          }>(`${apiUrl}/api/auth/refresh`, {}, { withCredentials: true });
          if (!cancelled) {
            setAuth({
              user: res.data.user,
              accessToken: res.data.accessToken,
              memberships: res.data.memberships,
              activeOrgId: res.data.activeOrg?.id,
            });
          }
        }
      } catch {
        if (!cancelled) {
          logout();
        }
      } finally {
        if (!cancelled) {
          useAuthStore.getState().setBootstrapped(true);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [isBootstrapped]);
}