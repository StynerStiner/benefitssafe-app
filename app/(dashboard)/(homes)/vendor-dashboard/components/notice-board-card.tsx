"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";

interface VendorProfile {
  name: string;
  email: string;
  phone: string;
  address: string;
  status: string;
  type: string;
  paymentMethod: string;
  taxIdCollected: boolean;
  organization?: { name: string };
}

const NoticeBoardCard = () => {
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/vendor/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setVendor(data))
      .catch(() => setVendor(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="card h-full border-0">
        <CardContent className="card-body p-0">
          <p className="text-sm text-neutral-500 text-center py-8">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!vendor) {
    return (
      <Card className="card h-full border-0">
        <CardContent className="card-body p-0">
          <p className="text-sm text-neutral-500 text-center py-8">Vendor profile not found.</p>
        </CardContent>
      </Card>
    );
  }

  const fields = [
    { label: "Business Name", value: vendor.name },
    { label: "Email", value: vendor.email },
    { label: "Phone", value: vendor.phone || "Not provided" },
    { label: "Address", value: vendor.address || "Not provided" },
    { label: "Type", value: vendor.type },
    { label: "Payment Method", value: vendor.paymentMethod || "Not set" },
    { label: "Tax ID", value: vendor.taxIdCollected ? "Collected" : "Not collected" },
  ];

  return (
    <Card className="card h-full border-0">
      <CardContent className="card-body p-0">
        <h6 className="mb-0 font-bold text-lg">Vendor Profile</h6>
        <div className="space-y-3 mt-4">
          {fields.map((f) => (
            <div key={f.label} className="flex items-center justify-between">
              <span className="text-sm text-neutral-500 dark:text-neutral-400">{f.label}</span>
              <span className="text-sm font-medium text-neutral-900 dark:text-white">{f.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
export default NoticeBoardCard;
