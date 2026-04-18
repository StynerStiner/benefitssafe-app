"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import StuckGrantsTable, {
  type StuckGrant,
} from "./components/stuck-grants-table";

export default function StuckGrantsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [grants, setGrants] = useState<StuckGrant[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/grants/stuck-overspend");
      if (!res.ok) throw new Error("load failed");
      const json = await res.json();
      setGrants(json.grants || []);
    } catch {
      setGrants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user || session.user.role !== "platform_admin") {
      router.replace("/dashboard");
      return;
    }
    load();
  }, [session, status, router, load]);

  if (status === "loading" || !session?.user) {
    return null;
  }
  if (session.user.role !== "platform_admin") {
    return null;
  }

  return (
    <>
      <DashboardBreadcrumb
        title="Stuck Overspend Grants"
        text="Stuck Overspend Grants"
      />

      <div className="card">
        <div className="card-header flex items-center justify-between flex-wrap gap-3">
          <div>
            <h6 className="text-lg font-semibold mb-0">
              Stuck Overspend Grants
            </h6>
            <p className="text-neutral-500 text-sm mb-0">
              Grants where the negative-balance flag is still set despite a
              restored balance. Reset only after confirming the incident is
              closed. See <code>docs/runbooks/stuck-overspend-grants.md</code>.
            </p>
          </div>
        </div>
        <div className="card-body">
          <StuckGrantsTable
            grants={grants}
            loading={loading}
            onResetSuccess={(id) =>
              setGrants((prev) => prev.filter((g) => g.id !== id))
            }
          />
        </div>
      </div>
    </>
  );
}
