import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import { useAuthStore } from "@/stores/authStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

const NO_REFRESH_PATHS = [
  "/api/auth/refresh",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
];

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function isAuthUrl(url: string): boolean {
  return NO_REFRESH_PATHS.some((path) => url.includes(path));
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const url = original?.url ?? "";

    if (status === 401 && original && !original._retry && !isAuthUrl(url)) {
      if (isRefreshing) {
        // Queue the request while a single refresh is in flight.
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then(() => api(original));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post<{ accessToken: string }>(
          `${API_URL}/api/auth/refresh`,
          { activeOrgId: useAuthStore.getState().activeOrgId },
          { withCredentials: true }
        );
        useAuthStore.getState().setAccessToken(data.accessToken);

        refreshQueue.forEach(({ resolve }) => resolve?.(undefined));
        refreshQueue = [];

        return api(original);
      } catch (refreshError) {
        refreshQueue.forEach(({ reject }) => reject?.(refreshError));
        refreshQueue = [];
        useAuthStore.getState().logout();
        if (typeof window !== "undefined") {
          window.location.assign("/login");
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);