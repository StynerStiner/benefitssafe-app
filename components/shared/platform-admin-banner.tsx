"use client";

// PlatformAdminBanner
// --------------------
// Persistent banner shown at the top of every dashboard page ONLY to
// platform_admin users. Two roles:
//
//   1. Make the "I am viewing another org's data" state unmistakable. A
//      platform admin staring at /grants could otherwise forget which
//      nonprofit's grants they're reviewing, which is a huge compliance
//      footgun when oversight actions get taken against the wrong org.
//
//   2. Be the org switcher. There's no "pick your active org" UI anywhere
//      else in the product for platform admins — this is it.
//
// Flow: the banner fetches /api/platform/orgs on open, the user picks one,
// we POST /api/platform/switch-org to mutate User.organizationId on the
// platform admin's own row, then call useSession().update({refreshOrg:true})
// so the JWT re-reads the new org. router.refresh() re-renders every server
// component with the updated session.

import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Building2,
  Check,
  ChevronDown,
  Search,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

interface PlatformOrg {
  id: string;
  name: string;
  orgCode: string | null;
  isPlatformOrg: boolean;
  subscriptionStatus: string;
}

export default function PlatformAdminBanner() {
  const { data: session, update } = useSession();
  const router = useRouter();

  const [orgs, setOrgs] = useState<PlatformOrg[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const role = session?.user?.role;
  const activeOrgId = session?.user?.organizationId;
  const activeOrgName = session?.user?.organizationName || "your platform org";

  // Lazy-load the org list when the user first opens the picker.
  useEffect(() => {
    if (!open || loaded || loading) return;
    setLoading(true);
    fetch("/api/platform/orgs")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.orgs)) {
          setOrgs(data.orgs);
          setLoaded(true);
        }
      })
      .catch(() => setError("Failed to load organizations"))
      .finally(() => setLoading(false));
  }, [open, loaded, loading]);

  // Close the popover on outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const filteredOrgs = useMemo(() => {
    if (!search.trim()) return orgs;
    const q = search.trim().toLowerCase();
    return orgs.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        (o.orgCode || "").toLowerCase().includes(q),
    );
  }, [orgs, search]);

  const activeOrg = orgs.find((o) => o.id === activeOrgId) ?? null;
  const viewingPlatformOrg = activeOrg?.isPlatformOrg ?? false;
  // Before the orgs list has loaded we can't tell whether the active org is
  // the platform org, so fall back to the session-supplied name + a neutral
  // color. Once loaded we show the proper warning color if viewing platform.
  const showWarning = loaded && viewingPlatformOrg;

  const handleSwitch = async (orgId: string) => {
    if (orgId === activeOrgId || switching) return;
    setSwitching(orgId);
    setError(null);
    try {
      const res = await fetch("/api/platform/switch-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to switch organization");
      }
      // Force the JWT to re-read the new org from DB so session.user.organizationId
      // reflects the change without a full sign-out.
      await update({ refreshOrg: true });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch organization");
    } finally {
      setSwitching(null);
    }
  };

  if (role !== "platform_admin") return null;

  return (
    <div
      className={`w-full border-b ${
        showWarning
          ? "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900"
          : "bg-primary/5 border-primary/20 dark:bg-primary/10"
      }`}
    >
      <div className="max-w-full px-4 md:px-6 py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {showWarning ? (
            <AlertTriangle
              className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0"
              aria-hidden="true"
            />
          ) : (
            <Building2
              className="w-4 h-4 text-primary shrink-0"
              aria-hidden="true"
            />
          )}
          <p className="text-xs md:text-sm text-neutral-700 dark:text-neutral-200 truncate">
            {showWarning ? (
              <>
                <span className="font-semibold">No nonprofit selected.</span>{" "}
                You are viewing the BenefitsSafe platform org — tenant pages
                will appear empty until you switch.
              </>
            ) : (
              <>
                <span className="text-neutral-500 dark:text-neutral-400">
                  Viewing as:
                </span>{" "}
                <span className="font-semibold">{activeOrgName}</span>
                {activeOrg?.orgCode && (
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {" "}
                    ({activeOrg.orgCode})
                  </span>
                )}
              </>
            )}
          </p>
        </div>

        <div className="relative" ref={popoverRef}>
          <Button
            size="sm"
            variant={showWarning ? "default" : "outline"}
            onClick={() => setOpen((o) => !o)}
            className="h-8 text-xs"
          >
            {showWarning ? "Select nonprofit" : "Switch org"}
            <ChevronDown
              className={`w-3.5 h-3.5 ml-1 transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </Button>

          {open && (
            <div className="absolute top-full right-0 mt-1 w-80 bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 z-50">
              <div className="p-3 border-b border-neutral-100 dark:border-neutral-800">
                <div className="relative">
                  <Search
                    className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or code…"
                    className="w-full pl-8 pr-2 py-1.5 text-sm rounded-md bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto p-1">
                {loading && (
                  <p className="px-3 py-3 text-sm text-neutral-500">
                    Loading organizations…
                  </p>
                )}
                {!loading && filteredOrgs.length === 0 && loaded && (
                  <p className="px-3 py-3 text-sm text-neutral-500">
                    No organizations match “{search}”.
                  </p>
                )}
                {filteredOrgs.map((o) => {
                  const isActive = o.id === activeOrgId;
                  const isSwitching = switching === o.id;
                  return (
                    <button
                      key={o.id}
                      onClick={() => handleSwitch(o.id)}
                      disabled={switching !== null}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors disabled:opacity-60 ${
                        isActive
                          ? "bg-primary/10 text-primary font-semibold"
                          : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">
                            {o.name}
                            {o.isPlatformOrg && (
                              <span className="ml-1.5 inline-block px-1.5 py-0.5 text-[10px] uppercase tracking-wider rounded bg-amber-500/15 text-amber-700 dark:text-amber-400">
                                Platform
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate">
                            {o.orgCode || "—"} · {o.subscriptionStatus}
                          </p>
                        </div>
                        {isSwitching ? (
                          <span className="text-xs text-neutral-500">…</span>
                        ) : (
                          isActive && (
                            <Check
                              className="w-4 h-4 text-primary shrink-0"
                              aria-hidden="true"
                            />
                          )
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              {error && (
                <p className="px-3 py-2 text-xs text-red-600 border-t border-neutral-100 dark:border-neutral-800">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
