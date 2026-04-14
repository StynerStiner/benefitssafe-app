"use client";

import type { InternalStaffMember } from "../page";

const ROLE_LABEL: Record<InternalStaffMember["role"], string> = {
  platform_admin: "Platform Admin",
  compliance_officer: "Compliance Officer",
  support_agent: "Support Agent",
  billing_admin: "Billing Admin",
};

const ROLE_BADGE: Record<InternalStaffMember["role"], string> = {
  platform_admin: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
  compliance_officer: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200",
  support_agent: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
  billing_admin: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200",
};

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString();
}

export default function InternalStaffTable({
  staff,
  loading,
}: {
  staff: InternalStaffMember[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="text-center text-neutral-500 py-12">Loading internal staff…</div>
    );
  }

  if (staff.length === 0) {
    return (
      <div className="text-center text-neutral-500 py-12">
        No internal staff yet. Click <b>Invite Internal Staff</b> to onboard your first BenefitsSafe team member.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-slate-700">
            <th className="text-left py-3 px-3">Name</th>
            <th className="text-left py-3 px-3">Email</th>
            <th className="text-left py-3 px-3">Role</th>
            <th className="text-left py-3 px-3">Org</th>
            <th className="text-left py-3 px-3">Status</th>
            <th className="text-left py-3 px-3">Last Login</th>
            <th className="text-left py-3 px-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((member) => (
            <tr
              key={member.id}
              className="border-b border-neutral-100 dark:border-slate-800"
            >
              <td className="py-3 px-3">
                {member.firstName} {member.lastName}
              </td>
              <td className="py-3 px-3 text-neutral-600 dark:text-neutral-300">
                {member.email}
              </td>
              <td className="py-3 px-3">
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${ROLE_BADGE[member.role]}`}
                >
                  {ROLE_LABEL[member.role]}
                </span>
              </td>
              <td className="py-3 px-3 text-neutral-600 dark:text-neutral-300">
                {member.organization?.name || "—"}
              </td>
              <td className="py-3 px-3">
                {member.hasPassword ? (
                  member.isActive ? (
                    <span className="text-green-600 dark:text-green-400">Active</span>
                  ) : (
                    <span className="text-neutral-500">Inactive</span>
                  )
                ) : (
                  <span className="text-yellow-600 dark:text-yellow-400">Invite pending</span>
                )}
              </td>
              <td className="py-3 px-3 text-neutral-600 dark:text-neutral-300">
                {formatDate(member.lastLoginAt)}
              </td>
              <td className="py-3 px-3 text-neutral-600 dark:text-neutral-300">
                {formatDate(member.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
