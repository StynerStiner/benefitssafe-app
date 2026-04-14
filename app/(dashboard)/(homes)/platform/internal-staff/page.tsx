"use client";

import { useCallback, useEffect, useState } from "react";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import InternalStaffTable from "./components/internal-staff-table";
import InviteStaffDialog from "./components/invite-staff-dialog";

export interface InternalStaffMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role:
    | "platform_admin"
    | "compliance_officer"
    | "support_agent"
    | "billing_admin";
  isActive: boolean;
  hasPassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  organization: { name: string; orgCode: string | null } | null;
}

export default function InternalStaffPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [staff, setStaff] = useState<InternalStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/internal-staff?limit=200");
      if (!res.ok) throw new Error("load failed");
      const json = await res.json();
      setStaff(json.staff || []);
    } catch {
      setStaff([]);
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
      <DashboardBreadcrumb title="Internal Staff" text="Internal Staff" />

      <div className="card">
        <div className="card-header flex items-center justify-between flex-wrap gap-3">
          <div>
            <h6 className="text-lg font-semibold mb-0">BenefitsSafe Internal Staff</h6>
            <p className="text-neutral-500 text-sm mb-0">
              Platform admins, compliance officers, support agents, and billing admins.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="btn btn-primary"
          >
            Invite Internal Staff
          </button>
        </div>
        <div className="card-body">
          <InternalStaffTable staff={staff} loading={loading} />
        </div>
      </div>

      <InviteStaffDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={load}
      />
    </>
  );
}
