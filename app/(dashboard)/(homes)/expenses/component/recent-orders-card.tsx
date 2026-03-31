"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Pencil, Trash2 } from "lucide-react";
import EditExpenseForm from "./edit-expense-form";

interface Expense {
    id: string;
    description: string;
    amount: string;
    status: string;
    expenseType: string;
    frequency: string;
    createdAt: string;
    vendorName: string | null;
    riskClassification: string | null;
    riskNotes: string | null;
    requestedBy: { id: string; firstName: string; lastName: string; email: string } | null;
    grant: { id: string; name: string } | null;
    category: { id: string; name: string } | null;
}

const statusVariant: Record<string, "warning" | "success" | "danger" | "info" | "default"> = {
    PENDING: "warning",
    APPROVED: "success",
    REJECTED: "danger",
    PAID: "info",
    CANCELLED: "danger",
};

interface RecentOrdersCardProps {
    expenses: Expense[];
    onRefresh?: () => void;
}

const RecentOrdersCard = ({ expenses, onRefresh }: RecentOrdersCardProps) => {
    const recent = expenses.slice(0, 8);

    // Edit state
    const [editExpense, setEditExpense] = useState<Expense | null>(null);
    const [editOpen, setEditOpen] = useState(false);

    // Reject dialog state
    const [rejectExpense, setRejectExpense] = useState<Expense | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [rejectLoading, setRejectLoading] = useState(false);

    // Delete dialog state
    const [deleteExpense, setDeleteExpense] = useState<Expense | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Approve loading state
    const [approveLoadingId, setApproveLoadingId] = useState<string | null>(null);

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

    const formatAmount = (a: string) =>
        `$${parseFloat(a || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

    const handleApprove = async (expense: Expense) => {
        setApproveLoadingId(expense.id);
        try {
            const res = await fetch(`/api/expenses/${expense.id}/approve`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                toast.error(data?.error || "Failed to approve expense");
                return;
            }
            toast.success("Expense approved");
            onRefresh?.();
        } catch {
            toast.error("Something went wrong");
        } finally {
            setApproveLoadingId(null);
        }
    };

    const handleReject = async () => {
        if (!rejectExpense) return;
        if (!rejectReason.trim()) {
            toast.error("Rejection reason is required");
            return;
        }
        setRejectLoading(true);
        try {
            const res = await fetch(`/api/expenses/${rejectExpense.id}/reject`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: rejectReason.trim() }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                toast.error(data?.error || "Failed to reject expense");
                return;
            }
            toast.success("Expense rejected");
            setRejectExpense(null);
            setRejectReason("");
            onRefresh?.();
        } catch {
            toast.error("Something went wrong");
        } finally {
            setRejectLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteExpense) return;
        setDeleteLoading(true);
        try {
            const res = await fetch(`/api/expenses/${deleteExpense.id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                toast.error(data?.error || "Failed to delete expense");
                return;
            }
            toast.success("Expense deleted");
            setDeleteExpense(null);
            onRefresh?.();
        } catch {
            toast.error("Something went wrong");
        } finally {
            setDeleteLoading(false);
        }
    };

    const openEdit = (expense: Expense) => {
        setEditExpense(expense);
        setEditOpen(true);
    };

    const openReject = (expense: Expense) => {
        setRejectExpense(expense);
        setRejectReason("");
    };

    const openDelete = (expense: Expense) => {
        setDeleteExpense(expense);
    };

    return (
        <>
            <Card className="card h-full border-0">
                <CardContent className="card-body p-0">
                    <div className="flex items-center flex-wrap gap-2 justify-between mb-5">
                        <h6 className="mb-0 font-bold text-lg">Recent Expense Requests</h6>
                        <CommonLink />
                    </div>
                    <div className="table-responsive scroll-sm">
                        <Table className="table-auto">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-sm">Description</TableHead>
                                    <TableHead className="text-sm">Requested By</TableHead>
                                    <TableHead className="text-sm">Grant</TableHead>
                                    <TableHead className="text-sm">Amount</TableHead>
                                    <TableHead className="text-sm">Date</TableHead>
                                    <TableHead className="text-sm text-center">Status</TableHead>
                                    <TableHead className="text-sm text-center">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recent.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-neutral-500 py-4">No expenses found</TableCell>
                                    </TableRow>
                                ) : (
                                    recent.map((exp) => (
                                        <TableRow key={exp.id}>
                                            <TableCell className="text-sm font-medium">{exp.description}</TableCell>
                                            <TableCell className="text-sm text-neutral-600 dark:text-neutral-300">
                                                {exp.requestedBy ? `${exp.requestedBy.firstName} ${exp.requestedBy.lastName}` : "Unknown"}
                                            </TableCell>
                                            <TableCell className="text-sm text-neutral-600 dark:text-neutral-300">
                                                {exp.grant?.name || "N/A"}
                                            </TableCell>
                                            <TableCell className="text-sm font-semibold">{formatAmount(exp.amount)}</TableCell>
                                            <TableCell className="text-sm text-neutral-600 dark:text-neutral-300">{formatDate(exp.createdAt)}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={statusVariant[exp.status] || "default"}>{exp.status}</Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {exp.status === "PENDING" ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                                                            title="Approve"
                                                            disabled={approveLoadingId === exp.id}
                                                            onClick={() => handleApprove(exp)}
                                                        >
                                                            <CheckCircle className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                            title="Reject"
                                                            onClick={() => openReject(exp)}
                                                        >
                                                            <XCircle className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-800"
                                                            title="Edit"
                                                            onClick={() => openEdit(exp)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                            title="Delete"
                                                            onClick={() => openDelete(exp)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-neutral-400">--</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Edit Expense Sheet */}
            {editExpense && (
                <EditExpenseForm
                    expense={editExpense}
                    open={editOpen}
                    onOpenChange={(val) => {
                        setEditOpen(val);
                        if (!val) setEditExpense(null);
                    }}
                    onSuccess={() => {
                        setEditOpen(false);
                        setEditExpense(null);
                        onRefresh?.();
                    }}
                />
            )}

            {/* Reject Dialog */}
            <Dialog open={!!rejectExpense} onOpenChange={(val) => { if (!val) setRejectExpense(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Expense</DialogTitle>
                        <DialogDescription>
                            Provide a reason for rejecting &quot;{rejectExpense?.description}&quot;.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <Label htmlFor="reject-reason" className="text-[#4b5563] dark:text-white mb-2">
                            Reason <span className="text-red-600">*</span>
                        </Label>
                        <Textarea
                            id="reject-reason"
                            placeholder="Enter rejection reason..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="mt-2"
                            rows={3}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setRejectExpense(null)}
                            disabled={rejectLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleReject}
                            disabled={rejectLoading || !rejectReason.trim()}
                        >
                            {rejectLoading ? "Rejecting..." : "Reject"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteExpense} onOpenChange={(val) => { if (!val) setDeleteExpense(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Expense</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete &quot;{deleteExpense?.description}&quot;? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteExpense(null)}
                            disabled={deleteLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleteLoading}
                        >
                            {deleteLoading ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default RecentOrdersCard;
