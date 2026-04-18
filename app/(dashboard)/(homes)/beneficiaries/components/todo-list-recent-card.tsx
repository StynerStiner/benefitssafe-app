"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ReasonModal } from "@/components/ui/reason-modal";
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
  createdAt: string;
  benefitPrograms: Record<string, boolean> | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  notes: string | null;
  isActive: boolean;
}

interface TodoListRecentCardProps {
  beneficiaries: Beneficiary[];
  onRefresh: () => void;
}

const programLabels: Record<string, string> = {
  ssi: "SSI",
  ssdi: "SSDI",
  mediCal: "Medi-Cal",
  medicaid: "Medicaid",
  able: "ABLE",
  calFresh: "CalFresh",
  ihss: "IHSS",
};

const TodoListRecentCard = ({ beneficiaries, onRefresh }: TodoListRecentCardProps) => {
    const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deactivateOpen, setDeactivateOpen] = useState(false);
    const [toggleTarget, setToggleTarget] = useState<Beneficiary | null>(null);
    const [toggling, setToggling] = useState(false);

    const recent = [...beneficiaries]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    const active = beneficiaries.filter((b) => b.isActive).slice(0, 5);

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

    const getPrograms = (bp: Record<string, boolean> | null) => {
        if (!bp) return [];
        return Object.entries(bp).filter(([, v]) => v).map(([k]) => programLabels[k] || k);
    };

    const handleEdit = (b: Beneficiary) => {
        setEditingBeneficiary(b);
        setEditOpen(true);
    };

    const handleToggleActive = (b: Beneficiary) => {
        setToggleTarget(b);
        // BSRS Ch 5 §5.3: deactivation is an irreversible state change on a
        // human subject and must capture a justification. Reactivation is
        // reversible — plain confirm is enough.
        if (b.isActive) {
            setDeactivateOpen(true);
        } else {
            setConfirmOpen(true);
        }
    };

    const sendToggle = async (payload: Record<string, unknown>): Promise<boolean> => {
        if (!toggleTarget) return false;
        const res = await fetch(`/api/beneficiaries/${toggleTarget.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => null);
            toast.error(data?.error || "Failed to update status");
            return false;
        }
        return true;
    };

    const confirmReactivate = async () => {
        if (!toggleTarget) return;
        setToggling(true);
        try {
            const ok = await sendToggle({ isActive: true });
            if (ok) {
                toast.success("Beneficiary activated");
                onRefresh();
            }
        } catch {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setToggling(false);
            setConfirmOpen(false);
            setToggleTarget(null);
        }
    };

    const confirmDeactivate = async (reason: string) => {
        const ok = await sendToggle({ isActive: false, reason });
        if (ok) {
            toast.success("Beneficiary deactivated");
            onRefresh();
            setDeactivateOpen(false);
            setToggleTarget(null);
        }
    };

    const renderList = (list: Beneficiary[]) => (
        <div className="flex flex-col gap-4">
            {list.length === 0 ? (
                <p className="text-sm text-neutral-500">No beneficiaries</p>
            ) : (
                list.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-2">
                        <div>
                            <h6 className="text-sm font-medium mb-0">
                                <Link href={`/beneficiaries/${b.id}`} className="hover:text-primary hover:underline">
                                  {b.firstName} {b.lastName}
                                </Link>
                                {!b.isActive && (
                                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-600/25 text-red-600 dark:text-red-400 font-medium">
                                        Inactive
                                    </span>
                                )}
                            </h6>
                            <span className="text-xs text-neutral-500 dark:text-neutral-300">{b.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="text-end">
                                <span className="text-xs text-neutral-500 block">{formatDate(b.createdAt)}</span>
                                <div className="flex flex-wrap gap-1 mt-1 justify-end">
                                    {getPrograms(b.benefitPrograms).map((p) => (
                                        <span key={p} className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-600/25 text-blue-600 dark:text-blue-400 font-medium">{p}</span>
                                    ))}
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleEdit(b)}
                                title="Edit beneficiary"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleToggleActive(b)}
                                title={b.isActive ? "Deactivate beneficiary" : "Activate beneficiary"}
                            >
                                {b.isActive ? (
                                    <UserX className="h-3.5 w-3.5 text-red-500" />
                                ) : (
                                    <UserCheck className="h-3.5 w-3.5 text-green-500" />
                                )}
                            </Button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    return (
        <>
            <Card className="card !p-0">
                <CardContent className="px-0">
                    <Tabs defaultValue="todoList" className="gap-0">
                        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-slate-600">
                            <TabsList className='bg-transparent dark:bg-transparent rounded-none h-[50px]  p-0'>
                                <TabsTrigger value="todoList" className='py-2.5 px-4 font-medium text-base inline-flex items-center gap-3 dark:bg-transparent text-neutral-600 hover:text-primary dark:text-white dark:hover:text-blue-500 border-0 border-b-1 border-transparent dark:border-transparent data-[state=active]:border-primary dark:data-[state=active]:border-primary dark:data-[state=active]:bg-transparent rounded-[0] data-[state=active]:shadow-none cursor-pointer translate-y-px'>
                                    Recently Added
                                </TabsTrigger>
                                <TabsTrigger value="recentLeads" className='py-2.5 px-4 font-medium text-base inline-flex items-center gap-3 dark:bg-transparent text-neutral-600 hover:text-primary dark:text-white dark:hover:text-blue-500 border-0 border-b-1 border-transparent dark:border-transparent data-[state=active]:border-primary dark:data-[state=active]:border-primary dark:data-[state=active]:bg-transparent rounded-[0] data-[state=active]:shadow-none cursor-pointer translate-y-px'>
                                    Active
                                </TabsTrigger>
                            </TabsList>
                            <div className="pe-6">
                                <CommonLink />
                            </div>
                        </div>

                        <div className="p-6">
                            <TabsContent value="todoList">
                                {renderList(recent)}
                            </TabsContent>
                            <TabsContent value="recentLeads">
                                {renderList(active)}
                            </TabsContent>
                        </div>
                    </Tabs>
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

            {/* Reactivation Confirmation (reversible — plain confirm) */}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Activate Beneficiary</DialogTitle>
                        <DialogDescription>
                            {`Are you sure you want to reactivate ${toggleTarget?.firstName ?? ""} ${toggleTarget?.lastName ?? ""}? They will appear in active beneficiary lists again.`}
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
                        <Button variant="default" onClick={confirmReactivate} disabled={toggling}>
                            {toggling ? "Processing..." : "Activate"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Deactivation Confirmation (irreversible state change — reason required) */}
            <ReasonModal
                open={deactivateOpen}
                onOpenChange={(next) => {
                    setDeactivateOpen(next);
                    if (!next) setToggleTarget(null);
                }}
                title="Deactivate Beneficiary"
                description={`Deactivating ${toggleTarget?.firstName ?? ""} ${toggleTarget?.lastName ?? ""} is logged in the audit trail. Provide a reason (minimum 10 characters) for compliance review.`}
                reasonLabel="Reason for deactivation"
                reasonPlaceholder="e.g. Beneficiary moved out of state, contact lost"
                confirmButtonText="Deactivate"
                confirmButtonVariant="destructive"
                onConfirm={confirmDeactivate}
            />
        </>
    );
};

export default TodoListRecentCard;
