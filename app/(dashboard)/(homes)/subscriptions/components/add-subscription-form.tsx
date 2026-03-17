"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";

interface Vendor {
    id: string;
    name: string;
    type: string;
    status: string;
}

interface BudgetCategory {
    id: string;
    name: string;
    allocatedAmount: string;
    spentAmount: string;
}

interface Grant {
    id: string;
    name: string;
    status: string;
    categories: BudgetCategory[];
}

const inputClassName =
    "border border-neutral-300 px-5 dark:border-slate-500 focus:border-primary dark:focus:border-primary focus-visible:border-primary h-12 rounded-lg !shadow-none !ring-0";

const labelClassName = "text-[#4b5563] dark:text-white mb-2";

const AddSubscriptionForm = () => {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [grants, setGrants] = useState<Grant[]>([]);
    const [categories, setCategories] = useState<BudgetCategory[]>([]);

    // Form state
    const [serviceName, setServiceName] = useState("");
    const [vendorId, setVendorId] = useState("");
    const [grantId, setGrantId] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [loginEmail, setLoginEmail] = useState("");
    const [monthlyCost, setMonthlyCost] = useState("");
    const [billingCycle, setBillingCycle] = useState("monthly");
    const [renewalDate, setRenewalDate] = useState("");
    const [billingUpdateStatus, setBillingUpdateStatus] = useState("PENDING");
    const [status, setStatus] = useState("ACTIVE");

    useEffect(() => {
        if (open) {
            // Fetch vendors
            fetch("/api/vendors")
                .then((res) => {
                    if (!res.ok) return { vendors: [] };
                    return res.json();
                })
                .then((data) => {
                    if (data?.vendors && Array.isArray(data.vendors)) {
                        setVendors(data.vendors);
                    }
                })
                .catch(() => {});

            // Fetch active grants (with categories included)
            fetch("/api/grants")
                .then((res) => {
                    if (!res.ok) return [];
                    return res.json();
                })
                .then((data) => {
                    if (Array.isArray(data)) {
                        const activeGrants = data.filter(
                            (g: Grant) => g.status === "ACTIVE"
                        );
                        setGrants(activeGrants);
                    }
                })
                .catch(() => {});
        }
    }, [open]);

    // Update categories when grant changes
    useEffect(() => {
        if (grantId) {
            const selectedGrant = grants.find((g) => g.id === grantId);
            if (selectedGrant?.categories) {
                setCategories(selectedGrant.categories);
            } else {
                setCategories([]);
            }
            setCategoryId("");
        } else {
            setCategories([]);
            setCategoryId("");
        }
    }, [grantId, grants]);

    const resetForm = () => {
        setServiceName("");
        setVendorId("");
        setGrantId("");
        setCategoryId("");
        setLoginEmail("");
        setMonthlyCost("");
        setBillingCycle("monthly");
        setRenewalDate("");
        setBillingUpdateStatus("PENDING");
        setStatus("ACTIVE");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!serviceName.trim()) {
            toast.error("Service name is required");
            return;
        }
        if (!vendorId) {
            toast.error("Vendor is required");
            return;
        }
        if (!grantId) {
            toast.error("Grant is required");
            return;
        }
        if (!categoryId) {
            toast.error("Budget category is required");
            return;
        }
        if (!monthlyCost || Number(monthlyCost) <= 0) {
            toast.error("Monthly cost must be a positive number");
            return;
        }

        setSubmitting(true);

        try {
            const body: Record<string, unknown> = {
                serviceName: serviceName.trim(),
                vendorId,
                grantId,
                categoryId,
                monthlyCost: Number(monthlyCost),
                billingCycle,
                billingUpdateStatus,
                status,
            };

            if (loginEmail.trim()) {
                body.loginEmail = loginEmail.trim();
            }
            if (renewalDate) {
                body.renewalDate = new Date(renewalDate).toISOString();
            }

            const res = await fetch("/api/subscriptions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                const message =
                    errorData?.error || "Failed to create subscription";
                toast.error(message);
                return;
            }

            toast.success("Subscription created successfully");
            setOpen(false);
            resetForm();
            router.refresh();
        } catch {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button>+ Add Subscription</Button>
            </SheetTrigger>
            <SheetContent
                side="right"
                className="sm:max-w-lg w-full overflow-y-auto"
            >
                <SheetHeader>
                    <SheetTitle>Add New Subscription</SheetTitle>
                </SheetHeader>

                <form
                    onSubmit={handleSubmit}
                    className="flex flex-col gap-4 px-4 pb-4"
                >
                    {/* Service Name */}
                    <div>
                        <Label htmlFor="serviceName" className={labelClassName}>
                            Service Name{" "}
                            <span className="text-red-600">*</span>
                        </Label>
                        <Input
                            type="text"
                            id="serviceName"
                            className={inputClassName}
                            placeholder="e.g. Adobe Creative Cloud"
                            value={serviceName}
                            onChange={(e) => setServiceName(e.target.value)}
                            required
                        />
                    </div>

                    {/* Vendor */}
                    <div>
                        <Label htmlFor="vendor" className={labelClassName}>
                            Vendor <span className="text-red-600">*</span>
                        </Label>
                        <Select value={vendorId} onValueChange={setVendorId}>
                            <SelectTrigger
                                className={`${inputClassName} w-full`}
                            >
                                <SelectValue placeholder="Select a vendor" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900">
                                {vendors.map((v) => (
                                    <SelectItem key={v.id} value={v.id}>
                                        {v.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Grant */}
                    <div>
                        <Label htmlFor="grant" className={labelClassName}>
                            Grant <span className="text-red-600">*</span>
                        </Label>
                        <Select value={grantId} onValueChange={setGrantId}>
                            <SelectTrigger
                                className={`${inputClassName} w-full`}
                            >
                                <SelectValue placeholder="Select a grant" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900">
                                {grants.map((g) => (
                                    <SelectItem key={g.id} value={g.id}>
                                        {g.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Budget Category */}
                    <div>
                        <Label htmlFor="category" className={labelClassName}>
                            Budget Category{" "}
                            <span className="text-red-600">*</span>
                        </Label>
                        <Select
                            value={categoryId}
                            onValueChange={setCategoryId}
                            disabled={!grantId}
                        >
                            <SelectTrigger
                                className={`${inputClassName} w-full`}
                            >
                                <SelectValue
                                    placeholder={
                                        grantId
                                            ? "Select a category"
                                            : "Select a grant first"
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900">
                                {categories.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                        {c.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Login Email */}
                    <div>
                        <Label htmlFor="loginEmail" className={labelClassName}>
                            Login Email
                        </Label>
                        <Input
                            type="email"
                            id="loginEmail"
                            className={inputClassName}
                            placeholder="account@example.com"
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                        />
                    </div>

                    {/* Monthly Cost */}
                    <div>
                        <Label htmlFor="monthlyCost" className={labelClassName}>
                            Monthly Cost{" "}
                            <span className="text-red-600">*</span>
                        </Label>
                        <Input
                            type="number"
                            id="monthlyCost"
                            className={inputClassName}
                            placeholder="0.00"
                            step="0.01"
                            min="0.01"
                            value={monthlyCost}
                            onChange={(e) => setMonthlyCost(e.target.value)}
                            required
                        />
                    </div>

                    {/* Billing Cycle */}
                    <div>
                        <Label
                            htmlFor="billingCycle"
                            className={labelClassName}
                        >
                            Billing Cycle
                        </Label>
                        <Select
                            value={billingCycle}
                            onValueChange={setBillingCycle}
                        >
                            <SelectTrigger
                                className={`${inputClassName} w-full`}
                            >
                                <SelectValue placeholder="Select billing cycle" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900">
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="quarterly">
                                    Quarterly
                                </SelectItem>
                                <SelectItem value="annual">Annual</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Renewal Date */}
                    <div>
                        <Label
                            htmlFor="renewalDate"
                            className={labelClassName}
                        >
                            Renewal Date
                        </Label>
                        <Input
                            type="date"
                            id="renewalDate"
                            className={inputClassName}
                            value={renewalDate}
                            onChange={(e) => setRenewalDate(e.target.value)}
                        />
                    </div>

                    {/* Billing Update Status */}
                    <div>
                        <Label
                            htmlFor="billingUpdateStatus"
                            className={labelClassName}
                        >
                            Billing Update Status
                        </Label>
                        <Select
                            value={billingUpdateStatus}
                            onValueChange={setBillingUpdateStatus}
                        >
                            <SelectTrigger
                                className={`${inputClassName} w-full`}
                            >
                                <SelectValue placeholder="Select billing update status" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900">
                                <SelectItem value="PENDING">Pending</SelectItem>
                                <SelectItem value="CARD_SHARED">
                                    Card Shared
                                </SelectItem>
                                <SelectItem value="UPDATED">Updated</SelectItem>
                                <SelectItem value="VERIFIED">
                                    Verified
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Status */}
                    <div>
                        <Label htmlFor="status" className={labelClassName}>
                            Status
                        </Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger
                                className={`${inputClassName} w-full`}
                            >
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900">
                                <SelectItem value="ACTIVE">Active</SelectItem>
                                <SelectItem value="PAUSED">Paused</SelectItem>
                                <SelectItem value="CANCELLED">
                                    Cancelled
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Submit */}
                    <div className="mt-2">
                        <Button
                            type="submit"
                            className="w-full h-12"
                            disabled={submitting}
                        >
                            {submitting
                                ? "Creating..."
                                : "Create Subscription"}
                        </Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
};

export default AddSubscriptionForm;
