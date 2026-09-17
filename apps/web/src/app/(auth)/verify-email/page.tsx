"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";

function VerifyEmailContent() {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("Verifying your email address...");
  const [resending, setResending] = useState(false);
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }
    api
      .post("/api/auth/verify-email", { token })
      .then((res) => {
        setStatus("success");
        setMessage(res.data?.message ?? "Email verified successfully.");
      })
      .catch((error) => {
        setStatus("error");
        setMessage(getErrorMessage(error));
      });
  }, []);

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

  return (
    <div className="mx-auto w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
      <div
        className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-2xl ${
          status === "success"
            ? "bg-green-100 text-green-600"
            : status === "error"
              ? "bg-red-100 text-red-600"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {status === "success" ? "✓" : status === "error" ? "✕" : "…"}
      </div>
      <h1 className="text-xl font-semibold">
        {status === "success"
          ? "Email verified"
          : status === "error"
            ? "Verification failed"
            : "Verifying email"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>

      <div className="mt-6 space-y-3">
        {status === "success" ? (
          <Link
            href="/login"
            className="block w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Continue to login
          </Link>
        ) : status === "error" ? (
          <>
            <button
              onClick={handleResend}
              disabled={resending}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {resending ? "Sending..." : "Resend verification email"}
            </button>
            <Link
              href="/login"
              className="block w-full rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Back to login
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="text-center text-sm">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
