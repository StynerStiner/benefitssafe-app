"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import CommonLink from "@/components/shared/common-link";
import { getInitials } from "@/lib/utils/get-initials";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, UserX, UserCheck } from "lucide-react";
import Link from "next/link";
import EditBeneficiaryForm from "./edit-beneficiary-form";

interface Beneficiary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  benefitPrograms: Record<string, boolean> | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  notes: string | null;
  isActive: boolean;
  onboardingStatus?: "active" | "pending_password" | "pending_invite";
  _count?: { grantsAsBeneficiary?: number; expenseRequests?: number };
}

interface TopPerformerCardProps {
  beneficiaries: Beneficiary[];
  onRefresh: () => void;
}

const TopPerformerCard = ({ beneficiaries, onRefresh }: TopPerformerCardProps) => {
  const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<Beneficiary | null>(null);
  const [toggling, setToggling] = useState(false);

  const sorted = [...beneficiaries]
    .sort((a, b) => (b._count?.grantsAsBeneficiary || 0) - (a._count?.grantsAsBeneficiary || 0))
    .slice(0, 6);

  const colors = ["bg-blue-600", "bg-green-500", "bg-yellow-500", "bg-purple-500", "bg-red-500", "bg-cyan-500"];

  const handleEdit = (b: Beneficiary) => {
    setEditingBeneficiary(b);
    setEditOpen(true);
  };

  const handleToggleActive = (b: Beneficiary) => {
    setToggleTarget(b);
    setConfirmOpen(true);
  };

  const confirmToggle = async () => {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/beneficiaries/${toggleTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !toggleTarget.isActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Failed to update status");
        return;
      }
      toast.success(
        toggleTarget.isActive
          ? "Beneficiary deactivated"
          : "Beneficiary activated"
      );
      onRefresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setToggling(false);
      setConfirmOpen(false);
      setToggleTarget(null);
    }
  };

  return (
    <>
      <Card className="card">
        <CardContent className="card-body p-0">
          <div className="flex items-center justify-between">
            <h3 className="mb-3 font-semibold text-lg">Most Active Beneficiaries</h3>
            <CommonLink />
          </div>

          <div className="mt-4 space-y-7.5">
            {sorted.length === 0 ? (
              <p className="text-sm text-neutral-500">No beneficiaries found</p>
            ) : (
              sorted.map((b, index) => {
                const initials = getInitials(`${b.firstName} ${b.lastName}`);
                const location = [b.addressCity, b.addressState].filter(Boolean).join(", ") || "No location";
                const grantCount = b._count?.grantsAsBeneficiary || 0;
                return (
                  <div
                    className="flex items-center justify-between gap-2"
                    key={b.id}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-10 h-10 rounded-full ${colors[index % colors.length]} text-white flex items-center justify-center text-sm font-semibold shrink-0`}>
                        {initials}
                      </span>
                      <div className="grow">
                        <h6 className="text-base mb-0 font-medium">
                          <Link href={`/beneficiaries/${b.id}`} className="hover:text-primary hover:underline">
                            {b.firstName} {b.lastName}
                          </Link>
                          {!b.isActive ? (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-600/25 text-red-600 dark:text-red-400 font-medium">
                              Inactive
                            </span>
                          ) : b.onboardingStatus === "active" ? (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-600/25 text-green-600 dark:text-green-400 font-medium">
                              Active
                            </span>
                          ) : b.onboardingStatus === "pending_password" ? (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-600/25 text-orange-600 dark:text-orange-400 font-medium">
                              Pending Password
                            </span>
                          ) : (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-600/25 text-yellow-600 dark:text-yellow-400 font-medium">
                              Pending Invite
                            </span>
                          )}
                        </h6>
                        <span className="text-sm text-neutral-500 dark:text-neutral-300 font-medium">
                          {location}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-600 dark:text-neutral-100 text-base font-medium">
                        {grantCount} grant{grantCount !== 1 ? "s" : ""}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(b)}
                        title="Edit beneficiary"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleToggleActive(b)}
                        title={b.isActive ? "Deactivate beneficiary" : "Activate beneficiary"}
                      >
                        {b.isActive ? (
                          <UserX className="h-4 w-4 text-red-500" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-green-500" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Sheet */}
      {editingBeneficiary && (
        <EditBeneficiaryForm
          beneficiary={editingBeneficiary}
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) setEditingBeneficiary(null);
          }}
          onSuccess={onRefresh}
        />
      )}

      {/* Deactivate / Activate Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {toggleTarget?.isActive ? "Deactivate" : "Activate"} Beneficiary
            </DialogTitle>
            <DialogDescription>
              {toggleTarget?.isActive
                ? `Are you sure you want to deactivate ${toggleTarget?.firstName} ${toggleTarget?.lastName}? They will no longer appear in active beneficiary lists.`
                : `Are you sure you want to reactivate ${toggleTarget?.firstName} ${toggleTarget?.lastName}? They will appear in active beneficiary lists again.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmOpen(false);
                setToggleTarget(null);
              }}
              disabled={toggling}
            >
              Cancel
            </Button>
            <Button
              variant={toggleTarget?.isActive ? "destructive" : "default"}
              onClick={confirmToggle}
              disabled={toggling}
            >
              {toggling
                ? "Processing..."
                : toggleTarget?.isActive
                  ? "Deactivate"
                  : "Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TopPerformerCard;
