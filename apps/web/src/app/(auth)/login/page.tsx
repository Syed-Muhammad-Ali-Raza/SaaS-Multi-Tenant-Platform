"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { loginSchema, type LoginInput } from "saas-shared";
import { useLoginMutation } from "@/hooks/useAuthMutations";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import type { AuthResponse } from "@/types";

interface RequiresTwoFactorResponse {
  requiresTwoFactor: true;
  mfaToken: string;
}

export default function LoginPage() {
  const router = useRouter();
  const login = useLoginMutation();
  const { setAuth } = useAuthStore();
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [verifyingMfa, setVerifyingMfa] = useState(false);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (mfaToken) {
    return <TwoFactorStep
      verifying={verifyingMfa}
      code={mfaCode}
      setCode={setMfaCode}
      onBack={() => setMfaToken(null)}
      onVerify={async (code) => {
        setVerifyingMfa(true);
        try {
          const { data } = await api.post<
            AuthResponse | { message: string }
          >("/api/auth/2fa/verify", { mfaToken, code });
          if ("accessToken" in data) {
            setAuth({
              user: data.user,
              accessToken: data.accessToken,
              memberships: data.memberships,
              activeOrgId: data.activeOrg?.id,
            });
            router.push("/dashboard");
          } else {
            toast.error(data.message);
          }
        } catch (error) {
          toast.error(getErrorMessage(error));
        } finally {
          setVerifyingMfa(false);
        }
      }}
    />;
  }

  async function onSubmit(data: LoginInput) {
    try {
      const res = await login.mutateAsync(data);
      if ("requiresTwoFactor" in res && res.requiresTwoFactor) {
        setMfaToken((res as RequiresTwoFactorResponse).mfaToken);
        return;
      }
      router.push("/dashboard");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground">Sign in to your account</p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input
              id="email"
              type="email"
              {...form.register("email")}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="you@example.com"
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input
              id="password"
              type="password"
              {...form.register("password")}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>

          <div className="text-right">
            <Link href="/forgot-password" className="text-sm text-primary hover:underline">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={login.isPending}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {login.isPending ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

function TwoFactorStep({
  onBack,
  onVerify,
  verifying,
  code,
  setCode,
}: {
  onBack: () => void;
  onVerify: (code: string) => Promise<void>;
  verifying: boolean;
  code: string;
  setCode: (code: string) => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Two-factor authentication</h1>
          <p className="text-muted-foreground">Enter the 6-digit code from your authenticator app, or a backup code</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onVerify(code);
          }}
          className="space-y-4"
        >
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="w-full rounded-md border bg-background px-3 py-2 text-center text-2xl tracking-widest"
          />

          <button
            type="submit"
            disabled={verifying || code.length < 6}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {verifying ? "Verifying..." : "Verify"}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="w-full text-sm text-muted-foreground hover:underline"
          >
            Back to sign in
          </button>
        </form>
      </div>
    </div>
  );
}
