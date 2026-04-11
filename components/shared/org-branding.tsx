"use client";

import { getInitials } from "@/lib/utils/get-initials";
import { useState } from "react";

interface OrgBrandingProps {
  organization: { name: string; logoUrl?: string | null };
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { box: 24, text: "text-[10px]", name: "text-xs" },
  md: { box: 32, text: "text-xs", name: "text-sm" },
  lg: { box: 48, text: "text-base", name: "text-base" },
};

// Logo image + name, or initials-circle fallback if no logo / load error.
// Never renders a broken image icon.
export default function OrgBranding({
  organization,
  size = "md",
  showName = true,
  className = "",
}: OrgBrandingProps) {
  const [imgError, setImgError] = useState(false);
  const { box, text, name: nameClass } = sizeMap[size];
  const hasLogo = Boolean(organization.logoUrl) && !imgError;
  const initials = getInitials(organization.name);

  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      {hasLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={organization.logoUrl!}
          alt={organization.name}
          onError={() => setImgError(true)}
          className="rounded-md object-contain bg-white shrink-0"
          style={{ width: box, height: box }}
        />
      ) : (
        <div
          className={`rounded-md bg-primary/10 text-primary font-semibold flex items-center justify-center shrink-0 ${text}`}
          style={{ width: box, height: box }}
          aria-label={organization.name}
          title={organization.name}
        >
          {initials}
        </div>
      )}
      {showName && (
        <span className={`truncate font-semibold text-neutral-700 dark:text-neutral-200 ${nameClass}`}>
          {organization.name}
        </span>
      )}
    </div>
  );
}
