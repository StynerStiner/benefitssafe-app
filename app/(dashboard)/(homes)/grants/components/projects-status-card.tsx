"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ArrowDownLeft, ArrowUpRight, Pencil, Archive } from "lucide-react";
import Link from "next/link";
import EditGrantForm from "./edit-grant-form";

interface Grant {
    id: string;
    name: string;
    description: string | null;
    status: string;
    totalAmount: string;
    spentAmount: string;
    remainingAmount: string;
    startDate: string;
    endDate: string | null;
    grantIssuerName: string;
    grantIssuerContact: string | null;
    purpose: string | null;
    blockedMCCs: string[] | null;
    beneficiaryId: string | null;
    beneficiary: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    } | null;
    categories: {
        id: string;
        name: string;
        allocatedAmount: string;
        spentAmount: string;
    }[];
    createdAt: string;
}

const statusColorMap: Record<string, string> = {
    DRAFT: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-400",
    ACTIVE: "bg-green-500/15 text-green-500 dark:text-green-500",
    PAUSED: "bg-yellow-500/15 text-yellow-500 dark:text-yellow-500",
    COMPLETED: "bg-purple-500/15 text-purple-500 dark:text-purple-500",
    ARCHIVED: "bg-red-500/15 text-red-500 dark:text-red-500",
};

interface ProjectsStatusCardProps {
    grants: Grant[];
    onRefresh: () => void;
}

const ProjectsStatusCard = ({ grants, onRefresh }: ProjectsStatusCardProps) => {
    const router = useRouter();
    const [editGrant, setEditGrant] = useState<Grant | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [archiveGrant, setArchiveGrant] = useState<Grant | null>(null);
    const [archiving, setArchiving] = useState(false);

    const formatCurrency = (val: string) => {
        const num = parseFloat(val || "0");
        return `$${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    };

    const getDaysRemaining = (endDate: string | null) => {
        if (!endDate) return "Ongoing";
        const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (diff < 0) return "Ended";
        return `${diff} Days`;
    };

    const getProgress = (total: string, spent: string) => {
        const t = parseFloat(total || "0");
        const s = parseFloat(spent || "0");
        if (t === 0) return 0;
        return Math.round((s / t) * 100);
    };

    const handleEdit = (grant: Grant) => {
        setEditGrant(grant);
        setEditOpen(true);
    };

    const handleEditSuccess = () => {
        setEditGrant(null);
        setEditOpen(false);
        onRefresh();
    };

    const handleArchive = async () => {
        if (!archiveGrant) return;
        setArchiving(true);
        try {
            const res = await fetch(`/api/grants/${archiveGrant.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "ARCHIVED" }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                const message = errorData?.error || "Failed to archive grant";
                toast.error(message);
                return;
            }

            toast.success("Grant archived successfully");
            setArchiveGrant(null);
            onRefresh();
            router.refresh();
        } catch {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setArchiving(false);
        }
    };

    return (
        <>
            <Card className="card !p-0 border-0 rounded-xl shadow-none">
                <CardContent className="p-0">
                    <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
                        <h3 className="font-semibold text-lg mb-0 text-foreground">Grants Status</h3>
                        <CommonLink />
                    </div>
                    <div className="card-body p-6">
                        <Table className="table-auto border-spacing-0 border-separate">
                            <TableHeader>
                                <TableRow className="border-0">
                                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600 rounded-tl-lg">
                                        Grant Name
                                    </TableHead>
                                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600">
                                        Beneficiary
                                    </TableHead>
                                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600">
                                        Budget
                                    </TableHead>
                                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600">
                                        Duration
                                    </TableHead>
                                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600">
                                        Spent
                                    </TableHead>
                                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600">
                                        Status
                                    </TableHead>
                                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600 rounded-tr-lg">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {grants.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 text-center text-neutral-500">
                                            No grants found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    grants.map((grant, index) => {
                                        const isLast = index === grants.length - 1;
                                        const progress = getProgress(grant.totalAmount, grant.spentAmount);
                                        const isOverHalf = progress > 50;
                                        const isArchived = grant.status === "ARCHIVED";

                                        return (
                                            <TableRow key={grant.id}>
                                                <TableCell className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""}`}>
                                                    <Link href={`/grants/${grant.id}`} className="text-primary hover:underline font-medium">
                                                        {grant.name}
                                                    </Link>
                                                </TableCell>
                                                <TableCell className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""}`}>
                                                    {grant.beneficiary ? `${grant.beneficiary.firstName} ${grant.beneficiary.lastName}` : "Unassigned"}
                                                </TableCell>
                                                <TableCell className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""}`}>
                                                    {formatCurrency(grant.totalAmount)}
                                                </TableCell>
                                                <TableCell className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""}`}>
                                                    {getDaysRemaining(grant.endDate)}
                                                </TableCell>
                                                <TableCell className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""}`}>
                                                    <span
                                                        className={`px-1.5 py-1 rounded font-semibold text-sm inline-flex items-center gap-1 ${isOverHalf
                                                            ? "bg-red-500/15 text-red-500"
                                                            : "bg-green-500/15 text-green-500"
                                                            }`}
                                                    >
                                                        {isOverHalf ? (
                                                            <ArrowUpRight className="w-4 h-4" />
                                                        ) : (
                                                            <ArrowDownLeft className="w-4 h-4" />
                                                        )}
                                                        {progress}%
                                                    </span>
                                                </TableCell>
                                                <TableCell className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600`}>
                                                    <span
                                                        className={`px-4 py-1 rounded font-semibold text-sm ${statusColorMap[grant.status] || statusColorMap.DRAFT}`}
                                                    >
                                                        {grant.status}
                                                    </span>
                                                </TableCell>
                                                <TableCell className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-br-lg" : ""}`}>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            onClick={() => handleEdit(grant)}
                                                            disabled={isArchived}
                                                            title="Edit grant"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                            onClick={() => setArchiveGrant(grant)}
                                                            disabled={isArchived}
                                                            title="Archive grant"
                                                        >
                                                            <Archive className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Edit Grant Sheet */}
            {editGrant && (
                <EditGrantForm
                    grant={editGrant}
                    open={editOpen}
                    onOpenChange={(open) => {
                        setEditOpen(open);
                        if (!open) setEditGrant(null);
                    }}
                    onSuccess={handleEditSuccess}
                />
            )}

            {/* Archive Confirmation Dialog */}
            <Dialog open={!!archiveGrant} onOpenChange={(open) => { if (!open) setArchiveGrant(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Archive Grant</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to archive &quot;{archiveGrant?.name}&quot;? This will soft-delete the grant. It can be restored later if needed.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setArchiveGrant(null)}
                            disabled={archiving}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleArchive}
                            disabled={archiving}
                        >
                            {archiving ? "Archiving..." : "Archive Grant"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default ProjectsStatusCard;
