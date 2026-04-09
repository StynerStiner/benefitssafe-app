// @ts-nocheck
"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useLoading } from "@/contexts/LoadingContext";
import { registerSchema } from "@/lib/zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Check, Eye, EyeOff, Loader2, Lock, Mail, Tag, UserRound, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import SocialLogin from "./social-login";

type PromoStatus = "idle" | "verifying" | "valid" | "invalid";

interface PromoVerificationResult {
  valid: boolean;
  trialDays?: number;
  description?: string;
  trialDescription?: string;
  error?: string;
}

const RegisterForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan");
  const checkoutSuccess = searchParams.get("checkout_success") === "true";
  const checkoutSessionId = searchParams.get("session_id");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { loading, setLoading } = useLoading();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Promo code verification state
  const [promoStatus, setPromoStatus] = useState<PromoStatus>("idle");
  const [promoResult, setPromoResult] = useState<PromoVerificationResult | null>(null);
  const lastVerifiedPromo = useRef<string>("");

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      organizationName: "",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      promoCode: "",
      acceptTerms: false as unknown as true,
    },
  });

  /**
   * Verify a promo code against the backend.
   */
  const verifyPromoCode = useCallback(async () => {
    const code = form.getValues("promoCode")?.trim().toUpperCase();
    if (!code) {
      setPromoStatus("idle");
      setPromoResult(null);
      lastVerifiedPromo.current = "";
      return;
    }

    // Skip if already verified this exact code
    if (lastVerifiedPromo.current === code && promoStatus === "valid") return;

    setPromoStatus("verifying");
    setPromoResult(null);

    try {
      const response = await fetch("/api/promo-codes/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (response.status === 429) {
        setPromoStatus("invalid");
        setPromoResult({ valid: false, error: "Too many attempts. Try again later." });
        return;
      }

      const data: PromoVerificationResult = await response.json();

      if (data.valid) {
        setPromoStatus("valid");
        setPromoResult(data);
        lastVerifiedPromo.current = code;
      } else {
        setPromoStatus("invalid");
        setPromoResult(data);
        lastVerifiedPromo.current = "";
      }
    } catch {
      setPromoStatus("invalid");
      setPromoResult({ valid: false, error: "Could not verify code. Try again." });
      lastVerifiedPromo.current = "";
    }
  }, [form, promoStatus]);

  const handleRegisterFormSubmit = async (
    values: z.infer<typeof registerSchema>
  ) => {
    setLoading(true);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationName: values.organizationName,
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          password: values.password,
          promoCode: values.promoCode?.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || data.error || "Registration failed. Please try again.");
        setIsSubmitting(false);
        return;
      }

      toast.success(
        "Account created! Please check your email to verify your account before signing in."
      );
      // Persist plan selection so it survives the email verification redirect
      if (planParam) {
        try { localStorage.setItem("benefitssafe_selected_plan", planParam); } catch {}
      }
      // Persist checkout session ID so it can be linked after email verification + login
      if (checkoutSessionId) {
        try { localStorage.setItem("benefitssafe_checkout_session_id", checkoutSessionId); } catch {}
      }
      form.reset();
      setTimeout(() => {
        const loginUrl = planParam ? `/auth/login?plan=${planParam}` : "/auth/login";
        router.push(loginUrl);
      }, 2500);
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
      setIsSubmitting(false);
    } finally {
      setLoading(false);
    }
  };

  const planLabels: Record<string, string> = {
    seed: "Seed - $49/month",
    core: "Core - $99/month",
    network: "Network - $199/month",
    enterprise: "Enterprise - $399/month",
    community: "Community - Free",
  };

  return (
    <>
      {checkoutSuccess && planParam && planLabels[planParam] && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800">
          <p className="text-sm text-center text-green-800 dark:text-green-300">
            <Check className="inline w-4 h-4 mr-1" />
            <span className="font-semibold">Payment confirmed!</span> Create your account to get started with {planLabels[planParam]}.
          </p>
        </div>
      )}
      {planParam && planLabels[planParam] && !checkoutSuccess && (
        <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-sm text-center">
            <span className="font-semibold">Selected plan:</span>{" "}
            {planLabels[planParam]}
          </p>
        </div>
      )}
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleRegisterFormSubmit)}
          className="space-y-3"
        >
          {/* Organization Name */}
          <FormField
            control={form.control}
            name="organizationName"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative">
                    <Building2 className="absolute start-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-700 dark:text-neutral-200" />
                    <Input
                      {...field}
                      type="text"
                      placeholder="Organization Name *"
                      className="ps-13 pe-12 h-11 rounded-lg bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary !shadow-none !ring-0"
                      disabled={loading}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* First Name & Last Name (side by side) */}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
                      <UserRound className="absolute start-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-700 dark:text-neutral-200" />
                      <Input
                        {...field}
                        type="text"
                        placeholder="First Name *"
                        className="ps-13 pe-4 h-11 rounded-lg bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary !shadow-none !ring-0"
                        disabled={loading}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
                      <UserRound className="absolute start-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-700 dark:text-neutral-200" />
                      <Input
                        {...field}
                        type="text"
                        placeholder="Last Name *"
                        className="ps-13 pe-4 h-11 rounded-lg bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary !shadow-none !ring-0"
                        disabled={loading}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Email Field */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute start-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-700 dark:text-neutral-200" />
                    <Input
                      {...field}
                      type="email"
                      placeholder="Email *"
                      className="ps-13 pe-12 h-11 rounded-lg bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary !shadow-none !ring-0"
                      disabled={loading}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Password Field */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute start-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-700 dark:text-neutral-200" />
                    <Input
                      {...field}
                      type={showPassword ? "text" : "password"}
                      placeholder="Password *"
                      className="ps-13 pe-12 h-11 rounded-lg bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary !shadow-none !ring-0"
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 !p-0 bg-transparent hover:bg-transparent text-muted-foreground h-[unset]"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Confirm Password Field */}
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute start-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-700 dark:text-neutral-200" />
                    <Input
                      {...field}
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm Password *"
                      className="ps-13 pe-12 h-11 rounded-lg bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary !shadow-none !ring-0"
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 !p-0 bg-transparent hover:bg-transparent text-muted-foreground h-[unset]"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Promo Code Field */}
          <FormField
            control={form.control}
            name="promoCode"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute start-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-700 dark:text-neutral-200" />
                      <Input
                        {...field}
                        type="text"
                        placeholder="Promo Code (optional)"
                        className="ps-13 pe-12 h-11 rounded-lg bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary !shadow-none !ring-0 uppercase"
                        disabled={loading}
                        maxLength={30}
                        onChange={(e) => {
                          field.onChange(e.target.value.toUpperCase());
                          // Reset verification when code changes
                          if (promoStatus !== "idle") {
                            setPromoStatus("idle");
                            setPromoResult(null);
                            lastVerifiedPromo.current = "";
                          }
                        }}
                      />
                      {/* Status indicator inside input */}
                      <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                        {promoStatus === "verifying" && (
                          <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
                        )}
                        {promoStatus === "valid" && (
                          <Check className="w-5 h-5 text-green-600" />
                        )}
                        {promoStatus === "invalid" && (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={verifyPromoCode}
                      disabled={loading || !field.value?.trim() || promoStatus === "verifying"}
                      className="h-14 px-5 rounded-xl border border-neutral-300 dark:border-slate-700 shrink-0"
                    >
                      {promoStatus === "verifying" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Verify"
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
                {/* Promo code feedback */}
                {promoStatus === "valid" && promoResult && (
                  <p className="text-sm text-green-600 mt-1">
                    Code accepted -- {promoResult.trialDescription || promoResult.description}
                  </p>
                )}
                {promoStatus === "invalid" && promoResult && (
                  <p className="text-sm text-red-600 mt-1">
                    {promoResult.error || "Invalid promo code"}
                  </p>
                )}
              </FormItem>
            )}
          />

          {/* Accept Terms */}
          <FormField
            control={form.control}
            name="acceptTerms"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-start gap-2 flex justify-between items-center">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      id="createAccount"
                      className="border border-neutral-500 w-4.5 h-4.5 mt-1"
                    />
                  </FormControl>
                  <label htmlFor="createAccount" className="text-sm">
                    By creating an account means you agree to the{" "}
                    <Link
                      href="#"
                      className="text-primary font-semibold hover:underline"
                    >
                      Terms & Conditions
                    </Link>{" "}
                    and our{" "}
                    <Link
                      href="#"
                      className="text-primary font-semibold hover:underline"
                    >
                      Privacy Policy
                    </Link>
                  </label>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Trial info banner */}
          <div className="text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-slate-800/50 rounded-lg p-2.5 border border-neutral-200 dark:border-slate-700">
            {promoStatus === "valid" && promoResult ? (
              <span>
                Your organization will receive{" "}
                <span className="font-semibold text-green-600">
                  {promoResult.trialDescription}
                </span>{" "}
                with code{" "}
                <span className="font-mono font-semibold">
                  {form.getValues("promoCode")}
                </span>
                . No credit card required.
              </span>
            ) : (
              <span>
                Every nonprofit gets a{" "}
                <span className="font-semibold">14-day free trial</span>.
                No credit card required. Have a promo code? Enter it above for extended access.
              </span>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full rounded-lg h-11 text-sm"
            disabled={loading}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin h-4.5 w-4.5 mr-2" />
                Creating your organization...
              </>
            ) : (
              "Create Organization"
            )}
          </Button>
        </form>
      </Form>

      {/* Divider */}
      <div className="mt-5 relative text-center before:absolute before:w-full before:h-px before:bg-neutral-300 dark:before:bg-slate-600 before:top-1/2 before:left-0">
        <span className="relative z-10 px-4 bg-white dark:bg-slate-900 text-base">
          Or sign up with
        </span>
      </div>

      {/* Social Login */}
      <SocialLogin />

      {/* Login Prompt */}
      <div className="mt-5 text-center text-sm">
        <p>
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="text-primary font-semibold hover:underline"
          >
            Sign In
          </Link>
        </p>
      </div>
    </>
  );
};

export default RegisterForm;
