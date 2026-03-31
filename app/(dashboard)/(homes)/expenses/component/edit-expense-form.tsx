"use client";

import { useState, useEffect } from "react";
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
} from "@/components/ui/sheet";

interface BudgetCategory {
    id: string;
    name: string;
    allocatedAmount: string;
    spentAmount: string;
}

interface Expense {
    id: string;
    description: string;
    amount: string;
    status: string;
    expenseType: string;
    frequency: string;
    vendorName: string | null;
    categoryId?: string;
    grantId?: string;
    grant: { id: string; name: string } | null;
    category: { id: string; name: string } | null;
}

interface EditExpenseFormProps {
    expense: Expense;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

const inputClassName =
    "border border-neutral-300 px-5 dark:border-slate-500 focus:border-primary dark:focus:border-primary focus-visible:border-primary h-12 rounded-lg !shadow-none !ring-0";

const labelClassName = "text-[#4b5563] dark:text-white mb-2";

const EditExpenseForm = ({ expense, open, onOpenChange, onSuccess }: EditExpenseFormProps) => {
    const [submitting, setSubmitting] = useState(false);
    const [categories, setCategories] = useState<BudgetCategory[]>([]);

    // Form state
    const [categoryId, setCategoryId] = useState("");
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const [vendorName, setVendorName] = useState("");

    // Populate form when expense changes
    useEffect(() => {
        if (expense && open) {
            setDescription(expense.description || "");
            setAmount(expense.amount ? String(parseFloat(expense.amount)) : "");
            setVendorName(expense.vendorName || "");
            setCategoryId(expense.category?.id || expense.categoryId || "");

            // Fetch categories for the grant
            const gId = expense.grant?.id || expense.grantId;
            if (gId) {
                fetch(`/api/grants/${gId}`)
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
        }
    }, [expense, open]);

    const formatCurrency = (value: string | number) => {
        const num = typeof value === "string" ? parseFloat(value) : value;
        if (isNaN(num)) return "$0.00";
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(num);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!description.trim()) {
            toast.error("Description is required");
            return;
        }
        if (!amount || Number(amount) <= 0) {
            toast.error("Amount must be a positive number");
            return;
        }

        setSubmitting(true);

        try {
            const body: Record<string, unknown> = {
                description: description.trim(),
                amount: Number(amount),
            };

            if (categoryId) {
                body.categoryId = categoryId;
            }
            body.vendorName = vendorName.trim() || "";

            const res = await fetch(`/api/expenses/${expense.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                const message = errorData?.error || "Failed to update expense";
                toast.error(message);
                return;
            }

            toast.success("Expense updated successfully");
            onOpenChange(false);
            onSuccess();
        } catch {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const isPending = expense.status === "PENDING";

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="sm:max-w-lg w-full overflow-y-auto"
            >
                <SheetHeader>
                    <SheetTitle>Edit Expense</SheetTitle>
                </SheetHeader>

                {!isPending ? (
                    <div className="px-4 py-6">
                        <p className="text-sm text-neutral-500">
                            This expense cannot be edited because it has been {expense.status.toLowerCase()}.
                        </p>
                    </div>
                ) : (
                    <form
                        onSubmit={handleSubmit}
                        className="flex flex-col gap-4 px-4 pb-4"
                    >
                        {/* Grant (read-only) */}
                        <div>
                            <Label className={labelClassName}>Grant</Label>
                            <Input
                                type="text"
                                className={inputClassName}
                                value={expense.grant?.name || "N/A"}
                                disabled
                            />
                        </div>

                        {/* Budget Category */}
                        <div>
                            <Label htmlFor="edit-category" className={labelClassName}>
                                Budget Category
                            </Label>
                            <Select value={categoryId} onValueChange={setCategoryId}>
                                <SelectTrigger className={`${inputClassName} w-full`}>
                                    <SelectValue placeholder="Select a budget category" />
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

                        {/* Description */}
                        <div>
                            <Label htmlFor="edit-description" className={labelClassName}>
                                Description <span className="text-red-600">*</span>
                            </Label>
                            <Input
                                type="text"
                                id="edit-description"
                                className={inputClassName}
                                placeholder="Describe the expense"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                required
                            />
                        </div>

                        {/* Amount */}
                        <div>
                            <Label htmlFor="edit-amount" className={labelClassName}>
                                Amount <span className="text-red-600">*</span>
                            </Label>
                            <Input
                                type="number"
                                id="edit-amount"
                                className={inputClassName}
                                placeholder="0.00"
                                step="0.01"
                                min="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                required
                            />
                        </div>

                        {/* Vendor Name */}
                        <div>
                            <Label htmlFor="edit-vendorName" className={labelClassName}>
                                Vendor Name
                            </Label>
                            <Input
                                type="text"
                                id="edit-vendorName"
                                className={inputClassName}
                                placeholder="Vendor name (optional)"
                                value={vendorName}
                                onChange={(e) => setVendorName(e.target.value)}
                            />
                        </div>

                        {/* Submit */}
                        <div className="mt-2">
                            <Button
                                type="submit"
                                className="w-full h-12"
                                disabled={submitting}
                            >
                                {submitting ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    </form>
                )}
            </SheetContent>
        </Sheet>
    );
};

export default EditExpenseForm;
