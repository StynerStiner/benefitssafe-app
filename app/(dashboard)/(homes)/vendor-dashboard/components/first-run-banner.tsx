"use client";

import EmptyState from "@/components/shared/empty-state";
import { UserCheck } from "lucide-react";
import { useEffect, useState } from "react";

interface VendorProfile {
  id: string;
  status: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  paymentMethod: string | null;
  taxIdCollected: boolean;
}

/**
 * Warm welcome banner for vendors who haven't finished setting up their
 * profile. Shows a "Complete your profile" CTA when the vendor record is
 * still in DRAFT or PENDING status, or when key profile fields are empty.
 *
 * Silent once the vendor is ACTIVE/APPROVED with a complete profile.
 */
export default function VendorFirstRunBanner() {
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/vendor/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => setVendor(v))
      .catch(() => setVendor(null))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  // Vendor record missing entirely — show welcome
  if (!vendor) {
    return (
      <div className="mb-6 rounded-xl bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700">
        <EmptyState
          icon={UserCheck}
          title="Welcome to BenefitsSafe"
          message="Your vendor profile is being set up. Once the organization that invited you activates your account, you'll see your payment history and active subscriptions here."
        />
      </div>
    );
  }

  const isIncomplete =
    vendor.status === "DRAFT" ||
    vendor.status === "PENDING" ||
    vendor.status === "AWAITING_PAYMENT_SETUP" ||
    !vendor.phone ||
    !vendor.paymentMethod;

  if (!isIncomplete) return null;

  return (
    <div className="mb-6 rounded-xl bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700">
      <EmptyState
        icon={UserCheck}
        title="Welcome! Let's finish your vendor profile"
        message="Add your payment details, tax information, and contact info so the organizations you work with can process invoices to you. This only takes a minute."
        ctaLabel="Complete Profile"
        ctaHref="/profile"
      />
    </div>
  );
}
