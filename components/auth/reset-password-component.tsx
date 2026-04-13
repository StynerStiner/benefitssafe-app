"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

const ResetPasswordComponent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("This reset link is missing its token. Request a new reset link.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data?.error ||
            "We couldn't reset your password. The link may have expired.",
        );
        return;
      }
      setDone(true);
      toast.success("Password updated. Redirecting to sign in…");
      setTimeout(() => router.push("/auth/login"), 2000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-5">
        <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">
          Missing reset token
        </p>
        <p className="text-sm text-red-600 dark:text-red-400 mb-3">
          The reset link you used is incomplete. Request a new one.
        </p>
        <Link
          href="/auth/forgot-password"
          className="text-sm text-primary font-semibold hover:underline"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-5">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <p className="text-sm font-semibold text-green-700 dark:text-green-300">
            Password updated
          </p>
        </div>
        <p className="text-sm text-green-600 dark:text-green-400">
          Redirecting you to sign in…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <Label htmlFor="new-password" className="text-sm font-semibold mb-2 block">
          New password
        </Label>
        <div className="relative">
          <Lock className="absolute start-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-700 dark:text-neutral-200" />
          <Input
            id="new-password"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            autoComplete="new-password"
            className="ps-13 h-14 rounded-xl bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary !shadow-none !ring-0"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="confirm-password" className="text-sm font-semibold mb-2 block">
          Confirm password
        </Label>
        <div className="relative">
          <Lock className="absolute start-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-700 dark:text-neutral-200" />
          <Input
            id="confirm-password"
            type="password"
            placeholder="Re-enter password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={submitting}
            autoComplete="new-password"
            className="ps-13 h-14 rounded-xl bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary !shadow-none !ring-0"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        className="w-full rounded-lg h-[52px] text-sm mt-2"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="animate-spin h-4.5 w-4.5 mr-2" />
            Updating…
          </>
        ) : (
          "Update password"
        )}
      </Button>

      <div className="mt-6 text-center text-sm">
        <p>
          Remembered it?{" "}
          <Link href="/auth/login" className="text-primary font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </form>
  );
};

export default ResetPasswordComponent;
