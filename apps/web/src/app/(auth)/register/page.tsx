"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { registerSchema, type RegisterInput } from "saas-shared";
import { useRegisterMutation } from "@/hooks/useAuthMutations";
import { getErrorMessage } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const register = useRegisterMutation();
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", name: "", orgName: "" },
  });

  async function onSubmit(data: RegisterInput) {
    try {
      await register.mutateAsync(data);
      router.push("/dashboard");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Create an account</h1>
          <p className="text-muted-foreground">
            You&apos;ll also create your organization
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {([
            { label: "Your name", field: "name" as const, type: "text", placeholder: "Jane Doe" },
            { label: "Email", field: "email" as const, type: "email", placeholder: "you@example.com" },
            { label: "Organization name", field: "orgName" as const, type: "text", placeholder: "Acme Inc" },
            { label: "Password", field: "password" as const, type: "password", placeholder: "" },
          ] as const).map(({ label, field, type, placeholder }) => (
            <div key={field} className="space-y-2">
              <label htmlFor={field} className="text-sm font-medium">{label}</label>
              <input
                id={field}
                type={type}
                {...form.register(field)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder={placeholder}
              />
              {form.formState.errors[field] && (
                <p className="text-sm text-destructive">{form.formState.errors[field]?.message}</p>
              )}
            </div>
          ))}

          <button
            type="submit"
            disabled={register.isPending}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {register.isPending ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}