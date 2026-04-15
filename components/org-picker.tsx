"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronDown, Check } from "lucide-react";
import OrgBranding from "@/components/shared/org-branding";

interface Membership {
  id: string;
  role: string;
  isDefaultOrg: boolean;
  organization: {
    id: string;
    name: string;
    logoUrl?: string | null;
  };
}

export default function OrgPicker() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { update } = useSession();

  useEffect(() => {
    fetch("/api/memberships")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMemberships(data);
          const defaultMembership = data.find((m: Membership) => m.isDefaultOrg);
          if (defaultMembership) {
            setActiveOrgId(defaultMembership.organization.id);
          } else if (data.length > 0) {
            setActiveOrgId(data[0].organization.id);
          }
        }
      })
      .catch(console.error);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSwitch = async (orgId: string) => {
    if (orgId === activeOrgId || switching) return;

    const targetOrg = memberships.find((m) => m.organization.id === orgId);
    const confirmed = window.confirm(
      `Switch to "${targetOrg?.organization.name}"?\n\nAll actions will be performed under this organization.`,
    );

    if (!confirmed) return;

    setSwitching(true);
    try {
      const res = await fetch("/api/memberships/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      });

      if (res.ok) {
        setActiveOrgId(orgId);
        setIsOpen(false);
        // Force the JWT to re-read User.organizationId from the DB so
        // every server component sees the new tenant on the next render.
        // Mirrors the platform-admin org switcher in
        // components/shared/platform-admin-banner.tsx — auth.ts honors
        // `refreshOrg: true` by re-fetching org + billing state. Without
        // this call, the client navigates but the JWT still carries the
        // old organizationId until the next login.
        await update({ refreshOrg: true });
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to switch org:", error);
    } finally {
      setSwitching(false);
    }
  };

  const activeOrg = memberships.find((m) => m.organization.id === activeOrgId);

  // Don't render until loaded; single org shows static display
  if (memberships.length === 0) return null;

  if (memberships.length === 1) {
    return (
      <div className="px-3 py-2">
        {activeOrg && <OrgBranding organization={activeOrg.organization} size="md" />}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm font-semibold rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        {activeOrg ? (
          <OrgBranding organization={activeOrg.organization} size="md" className="flex-1" />
        ) : (
          <span className="truncate text-neutral-700 dark:text-neutral-200">Select Organization</span>
        )}
        <ChevronDown className={`w-4 h-4 ml-auto shrink-0 text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[240px] bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 z-50">
          <div className="p-2 border-b border-neutral-100 dark:border-neutral-800">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium px-2 uppercase tracking-wider">
              Switch Organization
            </p>
          </div>
          <div className="p-1 max-h-64 overflow-y-auto">
            {memberships.map((m) => (
              <button
                key={m.id}
                onClick={() => handleSwitch(m.organization.id)}
                disabled={switching}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  m.organization.id === activeOrgId
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.organization.name}</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 capitalize">
                      {m.role.replace(/_/g, " ")}
                    </p>
                  </div>
                  {m.organization.id === activeOrgId && (
                    <Check className="w-4 h-4 text-primary shrink-0 ml-2" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
