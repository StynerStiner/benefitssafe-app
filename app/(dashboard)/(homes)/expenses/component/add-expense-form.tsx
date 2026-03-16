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

interface BudgetCategory {
    id: string;
    name: string;
    allocatedAmount: string;
    spentAmount: string;
}

interface Grant {
    id: string;
    name: string;
    remainingAmount: string;
    status: string;
    categories: BudgetCategory[];
}

interface Vendor {
    id: string;
    name: string;
    type: string;
}

const inputClassName =
    "border border-neutral-300 px-5 dark:border-slate-500 focus:border-primary dark:focus:border-primary focus-visible:border-primary h-12 rounded-lg !shadow-none !ring-0";

const labelClassName = "text-[#4b5563] dark:text-white mb-2";

const FREQUENCY_OPTIONS = [
    { value: "ONE_TIME", label: "One Time" },
    { value: "MONTHLY", label: "Monthly" },
    { value: "QUARTERLY", label: "Quarterly" },
    { value: "ANNUAL", label: "Annual" },
] as const;

const EXPENSE_TYPE_OPTIONS = [
    { value: "subscription", label: "Subscription" },
    { value: "invoice", label: "Invoice" },
    { value: "equipment", label: "Equipment" },
    { value: "other", label: "Other" },
] as const;

const AddExpenseForm = () => {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [grants, setGrants] = useState<Grant[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [categories, setCategories] = useState<BudgetCategory[]>([]);

    // Form state
    const [grantId, setGrantId] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [vendorId, setVendorId] = useState("");
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const [frequency, setFrequency] = useState("ONE_TIME");
    const [expenseType, setExpenseType] = useState("");

    // Fetch grants and vendors when sheet opens
    useEffect(() => {
        if (open) {
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
        }
    }, [open]);

    // Update categories when grant changes
    useEffect(() => {
        if (grantId) {
            const selectedGrant = grants.find((g) => g.id === grantId);
            if (selectedGrant?.categories) {
                setCategories(selectedGrant.categories);
            } else {
                // Fallback: fetch from grant detail endpoint
                fetch(`/api/grants/${grantId}`)
                    .then((res) => {
                        if (!res.ok) return null;
                        return res.json();
                    })
                    .then((data) => {
                        if (data?.categories && Array.isArray(data.categories)) {
                            setCategories(data.categories);
                        }
                    })
                    .catch(() => {});
            }
        } else {
            setCategories([]);
        }
        setCategoryId("");
    }, [grantId, grants]);

    const resetForm = () => {
        setGrantId("");
        setCategoryId("");
        setVendorId("");
        setDescription("");
        setAmount("");
        setFrequency("ONE_TIME");
        setExpenseType("");
        setCategories([]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!grantId) {
            toast.error("Grant is required");
            return;
        }
        if (!categoryId) {
            toast.error("Budget category is required");
            return;
        }
        if (!description.trim()) {
            toast.error("Description is required");
            return;
        }
        if (!amount || Number(amount) <= 0) {
            toast.error("Amount must be a positive number");
            return;
        }
        if (!expenseType) {
            toast.error("Expense type is required");
            return;
        }

        setSubmitting(true);

        try {
            const selectedVendor = vendors.find((v) => v.id === vendorId);

            const body: Record<string, unknown> = {
                grantId,
                categoryId,
                description: description.trim(),
                amount: Number(amount),
                frequency,
                expenseType,
            };

            if (selectedVendor) {
                body.vendorName = selectedVendor.name;
            }

            const res = await fetch("/api/expenses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                const message =
                    errorData?.error || "Failed to create expense";
                toast.error(message);
                return;
            }

            toast.success("Expense created successfully");
            setOpen(false);
            resetForm();
            router.refresh();
        } catch {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const formatCurrency = (value: string | number) => {
        const num = typeof value === "string" ? parseFloat(value) : value;
        if (isNaN(num)) return "$0.00";
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(num);
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button>+ Add Expense</Button>
            </SheetTrigger>
            <SheetContent
                side="right"
                className="sm:max-w-lg w-full overflow-y-auto"
            >
                <SheetHeader>
                    <SheetTitle>Add New Expense</SheetTitle>
                </SheetHeader>

                <form
                    onSubmit={handleSubmit}
                    className="flex flex-col gap-4 px-4 pb-4"
                >
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
                                        {g.name} ({formatCurrency(g.remainingAmount)} remaining)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Budget Category */}
                    <div>
                        <Label htmlFor="category" className={labelClassName}>
                            Budget Category <span className="text-red-600">*</span>
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
                                            ? "Select a budget category"
                                            : "Select a grant first"
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900">
                                {categories.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                        {c.name} ({formatCurrency(
                                            Number(c.allocatedAmount) - Number(c.spentAmount)
                                        )} remaining)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Vendor */}
                    <div>
                        <Label htmlFor="vendor" className={labelClassName}>
                            Vendor
                        </Label>
                        <Select value={vendorId} onValueChange={setVendorId}>
                            <SelectTrigger
                                className={`${inputClassName} w-full`}
                            >
                                <SelectValue placeholder="Select a vendor (optional)" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900">
                                {vendors.map((v) => (
                                    <SelectItem key={v.id} value={v.id}>
                                        {v.name} ({v.type.replace(/_/g, " ").toLowerCase()})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Description */}
                    <div>
                        <Label htmlFor="description" className={labelClassName}>
                            Description <span className="text-red-600">*</span>
                        </Label>
                        <Input
                            type="text"
                            id="description"
                            className={inputClassName}
                            placeholder="Describe the expense"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            required
                        />
                    </div>

                    {/* Amount */}
                    <div>
                        <Label htmlFor="amount" className={labelClassName}>
                            Amount <span className="text-red-600">*</span>
                        </Label>
                        <Input
                            type="number"
                            id="amount"
                            className={inputClassName}
                            placeholder="0.00"
                            step="0.01"
                            min="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </div>

                    {/* Frequency */}
                    <div>
                        <Label htmlFor="frequency" className={labelClassName}>
                            Frequency
                        </Label>
                        <Select value={frequency} onValueChange={setFrequency}>
                            <SelectTrigger
                                className={`${inputClassName} w-full`}
                            >
                                <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900">
                                {FREQUENCY_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Expense Type */}
                    <div>
                        <Label htmlFor="expenseType" className={labelClassName}>
                            Expense Type <span className="text-red-600">*</span>
                        </Label>
                        <Select value={expenseType} onValueChange={setExpenseType}>
                            <SelectTrigger
                                className={`${inputClassName} w-full`}
                            >
                                <SelectValue placeholder="Select expense type" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900">
                                {EXPENSE_TYPE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
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
                            {submitting ? "Submitting..." : "Submit Expense"}
                        </Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
};

export default AddExpenseForm;
