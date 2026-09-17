"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { acceptInviteSchema, type AcceptInviteInput } from "saas-shared";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import type { AuthResponse } from "@/types";

interface InvitationDetails {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  organization: { id: string; name: string; slug: string };
}

function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const form = useForm<AcceptInviteInput>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { name: "", password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<InvitationDetails>(`/api/invitations/${token}`)
      .then((res) => {
        setInvitation(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function onSubmit(data: AcceptInviteInput) {
    if (!token) return;
    try {
      const res = await api.post<{ accessToken: string; organization: { id: string; name: string } }>(
        `/api/invitations/${token}/accept`,
        { name: data.name, password: data.password }
      );
      useAuthStore.getState().setAuth({
          user: { id: "temp", email: invitation?.email ?? "", name: data.name, isSuperAdmin: false, emailVerified: false, twoFactorEnabled: false, lastLoginAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        accessToken: res.data.accessToken,
        memberships: [],
        activeOrgId: res.data.organization.id,
      });
      toast.success("Account created! Redirecting...");
      router.push("/dashboard");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Invalid invitation</h1>
          <p className="text-muted-foreground">This invitation link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Accept invitation</h1>
          <p className="text-muted-foreground">
            You&apos;ve been invited to join <strong>{invitation.organization.name}</strong>
          </p>
          <p className="text-sm text-muted-foreground">as <strong>{invitation.role.replace("_", " ")}</strong></p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">Your name</label>
            <input
              id="name"
              type="text"
              {...form.register("name")}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
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

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm password</label>
            <input
              id="confirmPassword"
              type="password"
              {...form.register("confirmPassword")}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            {form.formState.errors.confirmPassword && (
              <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {form.formState.isSubmitting ? "Creating account..." : "Join organization"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
      <AcceptInviteForm />
    </Suspense>
  );
}