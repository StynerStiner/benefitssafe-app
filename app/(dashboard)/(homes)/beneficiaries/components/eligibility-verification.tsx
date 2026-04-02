"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield } from "lucide-react";

interface EligibilityData {
  id?: string;
  beneficiaryId?: string;
  hasActiveWarrant: boolean;
  isCurrentlyIncarcerated: boolean;
  hasDrugTraffickingConviction: boolean;
  probationParoleRestrictions?: string | null;
  eligibilityStatus: string;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  exists?: boolean;
}

interface EligibilityVerificationProps {
  beneficiaryId: string;
  beneficiaryName: string;
}

const inputClassName =
  "border border-neutral-300 px-5 dark:border-slate-500 focus:border-primary dark:focus:border-primary focus-visible:border-primary h-12 rounded-lg !shadow-none !ring-0";

const labelClassName = "text-[#4b5563] dark:text-white mb-2";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ELIGIBLE: {
    label: "Eligible",
    className: "bg-green-500/15 text-green-600",
  },
  RESTRICTED_CALFRESH_ONLY: {
    label: "Restricted (CalFresh Only)",
    className: "bg-yellow-500/15 text-yellow-600",
  },
  INELIGIBLE_WARRANT: {
    label: "Ineligible (Active Warrant)",
    className: "bg-red-500/15 text-red-600",
  },
  INELIGIBLE_INCARCERATED: {
    label: "Ineligible (Incarcerated)",
    className: "bg-red-500/15 text-red-600",
  },
  PENDING_VERIFICATION: {
    label: "Pending Verification",
    className: "bg-neutral-500/15 text-neutral-600",
  },
};

const EligibilityVerification = ({
  beneficiaryId,
  beneficiaryName,
}: EligibilityVerificationProps) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);

  // Form state
  const [hasActiveWarrant, setHasActiveWarrant] = useState(false);
  const [isCurrentlyIncarcerated, setIsCurrentlyIncarcerated] = useState(false);
  const [hasDrugTraffickingConviction, setHasDrugTraffickingConviction] = useState(false);
  const [probationParoleRestrictions, setProbationParoleRestrictions] = useState("");

  const fetchEligibility = useCallback(async () => {
    try {
      const res = await fetch(`/api/beneficiaries/${beneficiaryId}/verify-eligibility`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: EligibilityData = await res.json();
      setEligibility(data);

      if (data.exists !== false) {
        setHasActiveWarrant(data.hasActiveWarrant);
        setIsCurrentlyIncarcerated(data.isCurrentlyIncarcerated);
        setHasDrugTraffickingConviction(data.hasDrugTraffickingConviction);
        setProbationParoleRestrictions(data.probationParoleRestrictions || "");
      }
    } catch {
      // If fetch fails, show pending state
      setEligibility({
        eligibilityStatus: "PENDING_VERIFICATION",
        hasActiveWarrant: false,
        isCurrentlyIncarcerated: false,
        hasDrugTraffickingConviction: false,
        exists: false,
      });
    } finally {
      setLoading(false);
    }
  }, [beneficiaryId]);

  useEffect(() => {
    fetchEligibility();
  }, [fetchEligibility]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/beneficiaries/${beneficiaryId}/verify-eligibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hasActiveWarrant,
          isCurrentlyIncarcerated,
          hasDrugTraffickingConviction,
          probationParoleRestrictions: probationParoleRestrictions.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const message = errorData?.error || "Failed to save eligibility verification";
        toast.error(message);
        return;
      }

      toast.success(`Eligibility verification saved for ${beneficiaryName}`);
      await fetchEligibility();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const statusInfo = STATUS_BADGE[eligibility?.eligibilityStatus || "PENDING_VERIFICATION"] || STATUS_BADGE.PENDING_VERIFICATION;

  if (loading) {
    return (
      <Card className="border border-neutral-200 dark:border-neutral-700">
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <span className="text-sm text-neutral-500">Loading eligibility...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-neutral-200 dark:border-neutral-700">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <CardTitle className="text-base">Compliance & Eligibility Verification</CardTitle>
        </div>
        <CardDescription>
          Verify cardholder eligibility before issuing benefit cards
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current status badge */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
            Status:
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
        </div>

        {/* Verified info */}
        {eligibility?.verifiedBy && eligibility?.verifiedAt && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Verified by {eligibility.verifiedBy} on{" "}
            {new Date(eligibility.verifiedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}

        {/* Checkbox flags */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="elig-warrant"
              checked={hasActiveWarrant}
              onCheckedChange={(checked) => setHasActiveWarrant(checked === true)}
            />
            <Label
              htmlFor="elig-warrant"
              className="text-[#4b5563] dark:text-white cursor-pointer text-sm"
            >
              Active felony warrant for flight/escape
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="elig-incarcerated"
              checked={isCurrentlyIncarcerated}
              onCheckedChange={(checked) => setIsCurrentlyIncarcerated(checked === true)}
            />
            <Label
              htmlFor="elig-incarcerated"
              className="text-[#4b5563] dark:text-white cursor-pointer text-sm"
            >
              Currently incarcerated
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="elig-drug"
              checked={hasDrugTraffickingConviction}
              onCheckedChange={(checked) => setHasDrugTraffickingConviction(checked === true)}
            />
            <Label
              htmlFor="elig-drug"
              className="text-[#4b5563] dark:text-white cursor-pointer text-sm"
            >
              Drug trafficking conviction on record
            </Label>
          </div>
        </div>

        {/* Probation/parole restrictions */}
        <div>
          <Label htmlFor="elig-probation" className={labelClassName}>
            Probation/parole restrictions (if any)
          </Label>
          <Input
            type="text"
            id="elig-probation"
            className={inputClassName}
            placeholder="Enter any probation or parole restrictions..."
            value={probationParoleRestrictions}
            onChange={(e) => setProbationParoleRestrictions(e.target.value)}
          />
        </div>

        {/* Save button */}
        <div className="pt-2">
          <Button
            type="button"
            className="w-full h-10"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? "Saving..." : "Verify & Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default EligibilityVerification;
