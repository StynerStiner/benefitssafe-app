"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Shield,
  Calendar,
  CircleAlert,
} from "lucide-react";

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  avatarUrl: string | null;
  addressCity: string | null;
  addressState: string | null;
  createdAt: string;
  beneficiaryCode: string | null;
}

const roleLabels: Record<string, string> = {
  nonprofit_admin: "Admin",
  nonprofit_staff: "Staff",
  cpa: "CPA",
  auditor: "Auditor",
  attorney: "Attorney",
  grant_officer: "Grant Officer",
  platform_admin: "Platform Admin",
  support_agent: "Support",
  compliance_officer: "Compliance",
  billing_admin: "Billing",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const TeamMemberProfile = () => {
  const params = useParams();
  const id = params.id as string;

  const [member, setMember] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/users/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load team member");
        return r.json();
      })
      .then((data) => setMember(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <>
        <DashboardBreadcrumb title="Team Member" text="Loading..." />
        <LoadingSkeleton />
      </>
    );
  }

  if (error || !member) {
    return (
      <>
        <DashboardBreadcrumb title="Team Member" text="Error" />
        <div className="mb-4">
          <Link href="/team">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="size-4" />
              Back to Team
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <CircleAlert className="mx-auto mb-3 size-10 text-neutral-400" />
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {error || "Team member not found."}
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  const fullName = `${member.firstName} ${member.lastName}`;
  const initials = `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase();
  const location = [member.addressCity, member.addressState].filter(Boolean).join(", ");

  return (
    <>
      <DashboardBreadcrumb title={fullName} text="Team Member Profile" />

      <div className="mb-6">
        <Link href="/team">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" />
            Back to Team
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-white">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                    {fullName}
                  </h2>
                  <Badge variant="info">
                    {roleLabels[member.role] || member.role}
                  </Badge>
                  <Badge variant={member.isActive ? "success" : "danger"}>
                    {member.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-col gap-1 text-sm text-neutral-600 dark:text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <Mail className="size-3.5" />
                    {member.email}
                  </span>
                  {member.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="size-3.5" />
                      {member.phone}
                    </span>
                  )}
                  {location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5" />
                      {location}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Calendar className="size-3.5" />
                    Joined {formatDate(member.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default TeamMemberProfile;
