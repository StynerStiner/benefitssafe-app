"use client";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import EmptyState from "@/components/shared/empty-state";
import PageDateFilter from "@/components/shared/page-date-filter";
import CustomSelect from "@/components/shared/custom-select";
import UsersListTable from '@/components/table/users-list-table';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Store } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import AddVendorForm from "./add-vendor-form";
import EditVendorForm from "./edit-vendor-form";

interface Vendor {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    website: string | null;
    type: string;
    status: string;
    address?: string | null;
    paymentMethod?: string | null;
    notes?: string | null;
    createdAt: string;
}

const typeLabels: Record<string, string> = {
    SAAS_SUBSCRIPTION: "SaaS Subscription",
    SERVICE_PROVIDER: "Service Provider",
    ONE_TIME_VENDOR: "One-Time Vendor",
};

const UsersList = () => {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [pageSize, setPageSize] = useState("10");

    // Edit state
    const [editVendor, setEditVendor] = useState<Vendor | null>(null);
    const [editOpen, setEditOpen] = useState(false);

    // View state
    const [viewVendor, setViewVendor] = useState<Vendor | null>(null);
    const [viewOpen, setViewOpen] = useState(false);

    // Delete state
    const [deleteVendor, setDeleteVendor] = useState<Vendor | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Reject state
    const [rejectVendor, setRejectVendor] = useState<Vendor | null>(null);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [rejecting, setRejecting] = useState(false);

    const fetchVendors = useCallback(() => {
        setLoading(true);
        fetch("/api/vendors")
            .then((r) => r.ok ? r.json() : [])
            .then((data) => {
                const list = Array.isArray(data) ? data : (data?.vendors && Array.isArray(data.vendors) ? data.vendors : []);
                setVendors(list);
                setError(null);
            })
            .catch(() => {
                setError("Failed to load vendors. Please try refreshing the page.");
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetchVendors();
    }, [fetchVendors]);

    const filteredVendors = useMemo(() => {
        let result = vendors;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter((v) =>
                v.name.toLowerCase().includes(q) ||
                (v.email && v.email.toLowerCase().includes(q)) ||
                (v.phone && v.phone.toLowerCase().includes(q))
            );
        }

        if (statusFilter && statusFilter !== "All") {
            result = result.filter((v) => v.status === statusFilter);
        }

        const limit = parseInt(pageSize, 10);
        if (limit > 0) {
            result = result.slice(0, limit);
        }

        return result;
    }, [vendors, searchQuery, statusFilter, pageSize]);

    // --- Handlers ---

    const handleView = (vendor: Vendor) => {
        setViewVendor(vendor);
        setViewOpen(true);
    };

    const handleEdit = (vendor: Vendor) => {
        setEditVendor(vendor);
        setEditOpen(true);
    };

    const handleDeleteClick = (vendor: Vendor) => {
        setDeleteVendor(vendor);
        setDeleteOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteVendor) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/vendors/${deleteVendor.id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                toast.error(errorData?.error || "Failed to delete vendor");
                return;
            }
            toast.success(`${deleteVendor.name} has been archived`);
            setDeleteOpen(false);
            setDeleteVendor(null);
            fetchVendors();
        } catch {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setDeleting(false);
        }
    };

    const handleApprove = async (vendor: Vendor) => {
        try {
            const res = await fetch(`/api/vendors/${vendor.id}/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                toast.error(errorData?.error || "Failed to approve vendor");
                return;
            }
            toast.success(`${vendor.name} has been approved`);
            fetchVendors();
        } catch {
            toast.error("Something went wrong. Please try again.");
        }
    };

    const handleRejectClick = (vendor: Vendor) => {
        setRejectVendor(vendor);
        setRejectReason("");
        setRejectOpen(true);
    };

    const handleRejectConfirm = async () => {
        if (!rejectVendor) return;
        setRejecting(true);
        try {
            const res = await fetch(`/api/vendors/${rejectVendor.id}/reject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: rejectReason.trim() }),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                toast.error(errorData?.error || "Failed to reject vendor");
                return;
            }
            toast.success(`${rejectVendor.name} has been rejected`);
            setRejectOpen(false);
            setRejectVendor(null);
            setRejectReason("");
            fetchVendors();
        } catch {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setRejecting(false);
        }
    };

    return (
        <>
            <div className="flex items-center justify-between">
                <DashboardBreadcrumb title="Vendors" text="Vendor Management" />
                <PageDateFilter
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    onChange={(month, year) => {
                        setSelectedMonth(month);
                        setSelectedYear(year);
                    }}
                />
            </div>

            {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            )}

            <Card className="card h-full !p-0 !block border-0 overflow-hidden mb-6">
                <CardHeader className="border-b border-neutral-200 dark:border-slate-600 !py-4 px-6 flex items-center flex-wrap gap-3 justify-between">
                    <div className="flex items-center flex-wrap gap-3">
                        <span className="text-base font-medium text-neutral-500 dark:text-neutral-300 mb-0">Show</span>
                        <CustomSelect
                            placeholder="10"
                            options={["10", "25", "50", "100"]}
                            value={pageSize}
                            onValueChange={setPageSize}
                        />
                        <div className="relative sm:max-w-[388px] w-full">
                            <Input
                                className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 shadow-none focus-visible:ring-0 focus-visible:border-primary border border-slate-300 h-10 pe-6 ps-11 w-full dark:border-slate-600 sm:block hidden"
                                placeholder="Search vendors..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <span className="sm:absolute sm:top-[50%] sm:start-0 sm:ms-4 sm:-translate-y-[50%]">
                                <Search className="text-neutral-500 dark:text-white" width={18} height={18} />
                            </span>
                        </div>
                        <CustomSelect
                            placeholder="Status"
                            options={["All", "PENDING", "APPROVED", "ACTIVE", "BLOCKED", "SUSPENDED", "REJECTED"]}
                            value={statusFilter}
                            onValueChange={setStatusFilter}
                        />
                    </div>
                    <AddVendorForm />
                </CardHeader>

                <CardContent className="card-body p-6">
                    {loading ? (
                        <p className="text-sm text-neutral-500 text-center py-8">Loading vendors...</p>
                    ) : vendors.length === 0 ? (
                        <EmptyState
                            icon={Store}
                            title="No vendors yet"
                            message="Add approved vendors that your beneficiaries can transact with. Vendors can be one-time, service providers, or SaaS subscriptions."
                        />
                    ) : (
                        <UsersListTable
                            vendors={filteredVendors}
                            onView={handleView}
                            onEdit={handleEdit}
                            onDelete={handleDeleteClick}
                            onApprove={handleApprove}
                            onReject={handleRejectClick}
                        />
                    )}
                </CardContent>
            </Card>

            {/* Edit Vendor Sheet */}
            <EditVendorForm
                vendor={editVendor}
                open={editOpen}
                onOpenChange={setEditOpen}
                onSuccess={fetchVendors}
            />

            {/* View Vendor Dialog */}
            <Dialog open={viewOpen} onOpenChange={setViewOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Vendor Details</DialogTitle>
                        <DialogDescription>
                            Details for {viewVendor?.name}
                        </DialogDescription>
                    </DialogHeader>
                    {viewVendor && (
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-neutral-500 dark:text-neutral-400">Name</span>
                                <span className="font-medium">{viewVendor.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neutral-500 dark:text-neutral-400">Email</span>
                                <span className="font-medium">{viewVendor.email || "-"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neutral-500 dark:text-neutral-400">Phone</span>
                                <span className="font-medium">{viewVendor.phone || "-"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neutral-500 dark:text-neutral-400">Website</span>
                                <span className="font-medium">{viewVendor.website || "-"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neutral-500 dark:text-neutral-400">Type</span>
                                <span className="font-medium">{typeLabels[viewVendor.type] || viewVendor.type}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neutral-500 dark:text-neutral-400">Status</span>
                                <span className="font-medium">{viewVendor.status}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neutral-500 dark:text-neutral-400">Added</span>
                                <span className="font-medium">
                                    {new Date(viewVendor.createdAt).toLocaleDateString("en-US", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                    })}
                                </span>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setViewOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete Vendor</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to archive {deleteVendor?.name}? This vendor will be soft-deleted and can be restored later.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteOpen(false)}
                            disabled={deleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteConfirm}
                            disabled={deleting}
                        >
                            {deleting ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Vendor Dialog */}
            <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Reject Vendor</DialogTitle>
                        <DialogDescription>
                            Provide a reason for rejecting {rejectVendor?.name}. This will block the vendor.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label htmlFor="rejectReason" className="text-[#4b5563] dark:text-white mb-2">
                                Reason (required, min 10 characters)
                            </Label>
                            <Textarea
                                id="rejectReason"
                                className="border border-neutral-300 px-5 dark:border-slate-500 focus:border-primary dark:focus:border-primary focus-visible:border-primary h-[100px] rounded-lg !shadow-none !ring-0"
                                placeholder="Enter reason for rejection..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setRejectOpen(false)}
                            disabled={rejecting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleRejectConfirm}
                            disabled={rejecting || rejectReason.trim().length < 10}
                        >
                            {rejecting ? "Rejecting..." : "Reject Vendor"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
export default UsersList;
