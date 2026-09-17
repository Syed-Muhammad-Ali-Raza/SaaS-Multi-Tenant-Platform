"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { useBootstrap } from "@/hooks/useBootstrap";
import { Header } from "@/components/layout/Header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { accessToken, isBootstrapped, user } = useAuthStore();
  const [resending, setResending] = useState(false);

  useBootstrap();

  useEffect(() => {
    if (isBootstrapped && !accessToken) {
      router.replace("/login");
    }
  }, [isBootstrapped, accessToken, router]);

  async function handleResend() {
    setResending(true);
    try {
      await api.post("/api/auth/send-verification-email");
      toast.success("Verification email sent. Check your inbox.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setResending(false);
    }
  }

  if (!isBootstrapped) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!accessToken) {
    return null;
  }

  const needsVerification = user && !user.emailVerified;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      {needsVerification ? (
        <div className="border-b bg-amber-50 dark:bg-amber-950/40">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 text-sm sm:px-6 lg:px-8">
            <span className="text-amber-700 dark:text-amber-300">
              Your email is not verified yet. Some features are unavailable until
              you confirm your address.
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="rounded-md border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950"
              >
                {resending ? "Sending..." : "Resend email"}
              </button>
              <Link
                href="/verify-email"
                className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700"
              >
                Verify now
              </Link>
              <Link
                href="/profile"
                className="rounded-md border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950"
              >
                Profile
              </Link>
            </div>
          </div>
        </div>
      ) : null}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
