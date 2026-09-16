import Link from "next/link";

export default function MarketingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="text-5xl font-bold tracking-tight">SaaS Platform</h1>
      <p className="mt-4 max-w-lg text-lg text-muted-foreground">
        A multi-tenant SaaS platform with role-based access control,
        organization management, and invitation workflows.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/login"
          className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="rounded-md border px-6 py-3 text-sm font-medium hover:bg-accent"
        >
          Get started
        </Link>
      </div>
    </div>
  );
}