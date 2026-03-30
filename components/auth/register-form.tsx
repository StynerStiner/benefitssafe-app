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
import { AlertTriangle, Building2, Check, Eye, EyeOff, Hash, Loader2, Lock, Mail, Tag, UserRound, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import SocialLogin from "./social-login";

type EINStatus = "idle" | "verifying" | "verified" | "not_found" | "error";
type PromoStatus = "idle" | "verifying" | "valid" | "invalid";

interface EINVerificationResult {
  verified: boolean;
  organizationName?: string;
  status?: string;
  city?: string;
  state?: string;
}

interface PromoVerificationResult {
  valid: boolean;
  trialDays?: number;
  description?: string;
  trialDescription?: string;
  error?: string;
}

const RegisterForm = () => {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { loading, setLoading } = useLoading();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // EIN verification state
  const [einStatus, setEinStatus] = useState<EINStatus>("idle");
  const [einVerified, setEinVerified] = useState(false);
  const lastVerifiedEIN = useRef<string>("");

  // Promo code verification state
  const [promoStatus, setPromoStatus] = useState<PromoStatus>("idle");
  const [promoResult, setPromoResult] = useState<PromoVerificationResult | null>(null);
  const lastVerifiedPromo = useRef<string>("");

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      ein: "",
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
   * Auto-format EIN as user types: inserts dash after 2nd digit (XX-XXXXXXX).
   */
  const formatEIN = (value: string): string => {
    const digits = value.replace(/[^\d]/g, "").slice(0, 9);
    if (digits.length > 2) {
      return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    }
    return digits;
  };

  /**
   * Verify the EIN against the ProPublica API via our backend endpoint.
   */
  const verifyEIN = useCallback(async (ein: string) => {
    const digits = ein.replace(/[^\d]/g, "");
    if (digits.length !== 9) return;

    // Skip if already verified this exact EIN
    if (lastVerifiedEIN.current === digits) return;

    setEinStatus("verifying");
    setEinVerified(false);

    try {
      const response = await fetch("/api/verify-ein", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ein }),
      });

      if (response.status === 429) {
        setEinStatus("error");
        return;
      }

      const data: EINVerificationResult = await response.json();

      if (data.verified && data.organizationName) {
        setEinStatus("verified");
        setEinVerified(true);
        lastVerifiedEIN.current = digits;
        // Auto-fill organization name from IRS data
        form.setValue("organizationName", data.organizationName, {
          shouldValidate: true,
        });
      } else {
        setEinStatus("not_found");
        setEinVerified(false);
        lastVerifiedEIN.current = "";
        // Allow manual entry of org name
        form.setValue("organizationName", "", { shouldValidate: false });
      }
    } catch {
      setEinStatus("error");
      setEinVerified(false);
      lastVerifiedEIN.current = "";
    }
  }, [form]);

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
          ein: values.ein,
          einVerified,
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

      const trialMsg = data.promoCodeApplied
        ? `Promo code applied! You have ${data.trialDays} days free.`
        : "You have a 14-day free trial.";

      toast.success(`Registration successful! ${trialMsg} Redirecting to login...`);
      form.reset();
      setTimeout(() => {
        router.push("/auth/login");
      }, 1500);
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
      setIsSubmitting(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleRegisterFormSubmit)}
          className="space-y-4"
        >
          {/* EIN Field */}
          <FormField
            control={form.control}
            name="ein"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative">
                    <Hash className="absolute start-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-700 dark:text-neutral-200" />
                    <Input
                      {...field}
                      type="text"
                      inputMode="numeric"
                      placeholder="EIN (XX-XXXXXXX)"
                      className="ps-13 pe-12 h-14 rounded-xl bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary !shadow-none !ring-0"
                      disabled={loading}
                      maxLength={10}
                      onChange={(e) => {
                        const formatted = formatEIN(e.target.value);
                        field.onChange(formatted);
                        // Auto-verify when 9 digits are entered
                        const digits = formatted.replace(/[^\d]/g, "");
                        if (digits.length === 9) {
                          verifyEIN(formatted);
                        } else {
                          // Reset verification state when EIN changes
                          setEinStatus("idle");
                          setEinVerified(false);
                          lastVerifiedEIN.current = "";
                        }
                      }}
                      onBlur={() => {
                        field.onBlur();
                        const digits = field.value.replace(/[^\d]/g, "");
                        if (digits.length === 9) {
                          verifyEIN(field.value);
                        }
                      }}
                    />
                    {/* Verification status indicator */}
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                      {einStatus === "verifying" && (
                        <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
                      )}
                      {einStatus === "verified" && (
                        <Check className="w-5 h-5 text-green-600" />
                      )}
                      {einStatus === "not_found" && (
                        <AlertTriangle className="w-5 h-5 text-yellow-600" />
                      )}
                      {einStatus === "error" && (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                  </div>
                </FormControl>
                <FormMessage />
                {/* EIN verification feedback messages */}
                {einStatus === "verified" && (
                  <p className="text-sm text-green-600 mt-1">
                    EIN verified -- organization found in IRS database.
                  </p>
                )}
                {einStatus === "not_found" && (
                  <p className="text-sm text-yellow-600 mt-1">
                    EIN not found in IRS database. Your account will require manual review.
                  </p>
                )}
                {einStatus === "error" && (
                  <p className="text-sm text-red-600 mt-1">
                    Could not verify EIN. Please try again.
                  </p>
                )}
              </FormItem>
            )}
          />

          {/* Organization Name */}
          <FormField
            control={form.control}
            name="organizationName"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative">
                    <Building2 className="absolute start-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-700 dark:text-neutral-200" />
                    <Input
                      {...field}
                      type="text"
                      placeholder="Organization Name"
                      className="ps-13 pe-12 h-14 rounded-xl bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary !shadow-none !ring-0"
                      disabled={loading || einVerified}
                      readOnly={einVerified}
                    />
                  </div>
                </FormControl>
                <FormMessage />
                {einVerified && (
                  <p className="text-sm text-neutral-500 mt-1">
                    Auto-filled from IRS records. Clear the EIN field to edit manually.
                  </p>
                )}
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
                      <UserRound className="absolute start-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-700 dark:text-neutral-200" />
                      <Input
                        {...field}
                        type="text"
                        placeholder="First Name"
                        className="ps-13 pe-4 h-14 rounded-xl bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary !shadow-none !ring-0"
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
                      <UserRound className="absolute start-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-700 dark:text-neutral-200" />
                      <Input
                        {...field}
                        type="text"
                        placeholder="Last Name"
                        className="ps-13 pe-4 h-14 rounded-xl bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary !shadow-none !ring-0"
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
                    <Mail className="absolute start-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-700 dark:text-neutral-200" />
                    <Input
                      {...field}
                      type="email"
                      placeholder="Email"
                      className="ps-13 pe-12 h-14 rounded-xl bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary !shadow-none !ring-0"
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
                    <Lock className="absolute start-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-700 dark:text-neutral-200" />
                    <Input
                      {...field}
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      className="ps-13 pe-12 h-14 rounded-xl bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary !shadow-none !ring-0"
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
                    <Lock className="absolute start-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-700 dark:text-neutral-200" />
                    <Input
                      {...field}
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm Password"
                      className="ps-13 pe-12 h-14 rounded-xl bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary !shadow-none !ring-0"
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
                      <Tag className="absolute start-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-700 dark:text-neutral-200" />
                      <Input
                        {...field}
                        type="text"
                        placeholder="Promo Code (optional)"
                        className="ps-13 pe-12 h-14 rounded-xl bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary !shadow-none !ring-0 uppercase"
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
          <div className="text-sm text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-slate-800/50 rounded-lg p-3 border border-neutral-200 dark:border-slate-700">
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
            className="w-full rounded-lg mt-1 h-[52px] text-sm mt-2"
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
      <div className="mt-8 relative text-center before:absolute before:w-full before:h-px before:bg-neutral-300 dark:before:bg-slate-600 before:top-1/2 before:left-0">
        <span className="relative z-10 px-4 bg-white dark:bg-slate-900 text-base">
          Or sign up with
        </span>
      </div>

      {/* Social Login */}
      <SocialLogin />

      {/* Login Prompt */}
      <div className="mt-8 text-center text-sm">
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
