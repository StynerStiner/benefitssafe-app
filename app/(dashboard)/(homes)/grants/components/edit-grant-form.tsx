"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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

interface Beneficiary {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

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

const BENEFIT_FLAGS = [
    { key: "ssi", label: "SSI" },
    { key: "ssdi", label: "SSDI" },
    { key: "mediCal", label: "Medi-Cal" },
    { key: "medicaid", label: "Medicaid" },
    { key: "able", label: "ABLE" },
    { key: "calFresh", label: "CalFresh" },
    { key: "ihss", label: "IHSS" },
] as const;

const inputClassName =
    "border border-neutral-300 px-5 dark:border-slate-500 focus:border-primary dark:focus:border-primary focus-visible:border-primary h-12 rounded-lg !shadow-none !ring-0";

const labelClassName = "text-[#4b5563] dark:text-white mb-2";

const textareaClassName =
    "border border-neutral-300 px-5 dark:border-slate-500 focus:border-primary dark:focus:border-primary focus-visible:border-primary h-[120px] rounded-lg !shadow-none !ring-0";

interface EditGrantFormProps {
    grant: Grant;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

const EditGrantForm = ({ grant, open, onOpenChange, onSuccess }: EditGrantFormProps) => {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);

    // Form state - initialized from grant
    const [name, setName] = useState(grant.name);
    const [grantIssuerName, setGrantIssuerName] = useState(grant.grantIssuerName);
    const [grantIssuerContact, setGrantIssuerContact] = useState(grant.grantIssuerContact || "");
    const [totalAmount, setTotalAmount] = useState(grant.totalAmount);
    const [startDate, setStartDate] = useState(
        grant.startDate ? new Date(grant.startDate).toISOString().split("T")[0] : ""
    );
    const [endDate, setEndDate] = useState(
        grant.endDate ? new Date(grant.endDate).toISOString().split("T")[0] : ""
    );
    const [beneficiaryId, setBeneficiaryId] = useState(grant.beneficiaryId || "");
    const [description, setDescription] = useState(grant.description || "");
    const [restrictions, setRestrictions] = useState("");
    const [status, setStatus] = useState(grant.status);
    const [benefitFlags, setBenefitFlags] = useState<Record<string, boolean>>({
        ssi: false,
        ssdi: false,
        mediCal: false,
        medicaid: false,
        able: false,
        calFresh: false,
        ihss: false,
    });

    // Re-sync form state when grant prop changes
    useEffect(() => {
        setName(grant.name);
        setGrantIssuerName(grant.grantIssuerName);
        setGrantIssuerContact(grant.grantIssuerContact || "");
        setTotalAmount(grant.totalAmount);
        setStartDate(
            grant.startDate ? new Date(grant.startDate).toISOString().split("T")[0] : ""
        );
        setEndDate(
            grant.endDate ? new Date(grant.endDate).toISOString().split("T")[0] : ""
        );
        setBeneficiaryId(grant.beneficiaryId || "");
        setDescription(grant.description || "");
        setStatus(grant.status);
    }, [grant]);

    useEffect(() => {
        if (open) {
            fetch("/api/users?role=beneficiary")
                .then((res) => {
                    if (!res.ok) return [];
                    return res.json();
                })
                .then((data) => {
                    if (Array.isArray(data)) setBeneficiaries(data);
                })
                .catch(() => {});
        }
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            toast.error("Grant name is required");
            return;
        }
        if (!grantIssuerName.trim()) {
            toast.error("Grant issuer name is required");
            return;
        }
        if (!totalAmount || Number(totalAmount) <= 0) {
            toast.error("Total amount must be a positive number");
            return;
        }
        if (!startDate) {
            toast.error("Start date is required");
            return;
        }
        if (!endDate) {
            toast.error("End date is required");
            return;
        }

        // Validate email format for grant issuer contact (if provided)
        if (grantIssuerContact.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(grantIssuerContact.trim())) {
                toast.error("Grant issuer contact must be a valid email address");
                return;
            }
        }

        // Validate endDate is after startDate
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end <= start) {
            toast.error("End date must be after start date");
            return;
        }

        setSubmitting(true);

        try {
            const body: Record<string, unknown> = {
                name: name.trim(),
                grantIssuerName: grantIssuerName.trim(),
                totalAmount: Number(totalAmount),
                startDate: new Date(startDate).toISOString(),
                endDate: new Date(endDate).toISOString(),
                status,
                benefitFlags,
            };

            if (grantIssuerContact.trim()) {
                body.grantIssuerContact = grantIssuerContact.trim();
            }
            if (beneficiaryId) {
                body.beneficiaryId = beneficiaryId;
            }
            if (description.trim()) {
                body.description = description.trim();
            }
            if (restrictions.trim()) {
                body.restrictions = restrictions.trim();
            }

            const res = await fetch(`/api/grants/${grant.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                const message =
                    errorData?.error || "Failed to update grant";
                toast.error(message);
                return;
            }

            toast.success("Grant updated successfully");
            onOpenChange(false);
            onSuccess();
            router.refresh();
        } catch {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const toggleBenefitFlag = (key: string) => {
        setBenefitFlags((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="sm:max-w-lg w-full overflow-y-auto"
            >
                <SheetHeader>
                    <SheetTitle>Edit Grant</SheetTitle>
                </SheetHeader>

                <form
                    onSubmit={handleSubmit}
                    className="flex flex-col gap-4 px-4 pb-4"
                >
                    {/* Grant Name */}
                    <div>
                        <Label htmlFor="editGrantName" className={labelClassName}>
                            Grant Name <span className="text-red-600">*</span>
                        </Label>
                        <Input
                            type="text"
                            id="editGrantName"
                            className={inputClassName}
                            placeholder="Enter grant name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    {/* Grant Issuer Name */}
                    <div>
                        <Label
                            htmlFor="editGrantIssuerName"
                            className={labelClassName}
                        >
                            Grant Issuer Name{" "}
                            <span className="text-red-600">*</span>
                        </Label>
                        <Input
                            type="text"
                            id="editGrantIssuerName"
                            className={inputClassName}
                            placeholder="Foundation or funder name"
                            value={grantIssuerName}
                            onChange={(e) =>
                                setGrantIssuerName(e.target.value)
                            }
                            required
                        />
                    </div>

                    {/* Grant Issuer Contact Email */}
                    <div>
                        <Label
                            htmlFor="editGrantIssuerContact"
                            className={labelClassName}
                        >
                            Grant Issuer Contact Email
                        </Label>
                        <Input
                            type="email"
                            id="editGrantIssuerContact"
                            className={inputClassName}
                            placeholder="contact@foundation.org"
                            value={grantIssuerContact}
                            onChange={(e) =>
                                setGrantIssuerContact(e.target.value)
                            }
                        />
                    </div>

                    {/* Total Amount */}
                    <div>
                        <Label
                            htmlFor="editTotalAmount"
                            className={labelClassName}
                        >
                            Total Amount{" "}
                            <span className="text-red-600">*</span>
                        </Label>
                        <Input
                            type="number"
                            id="editTotalAmount"
                            className={inputClassName}
                            placeholder="0.00"
                            step="0.01"
                            min="0.01"
                            value={totalAmount}
                            onChange={(e) => setTotalAmount(e.target.value)}
                            required
                        />
                    </div>

                    {/* Start Date */}
                    <div>
                        <Label htmlFor="editStartDate" className={labelClassName}>
                            Start Date{" "}
                            <span className="text-red-600">*</span>
                        </Label>
                        <Input
                            type="date"
                            id="editStartDate"
                            className={inputClassName}
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            required
                        />
                    </div>

                    {/* End Date */}
                    <div>
                        <Label htmlFor="editEndDate" className={labelClassName}>
                            End Date{" "}
                            <span className="text-red-600">*</span>
                        </Label>
                        <Input
                            type="date"
                            id="editEndDate"
                            className={inputClassName}
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            required
                        />
                    </div>

                    {/* Beneficiary */}
                    <div>
                        <Label
                            htmlFor="editBeneficiary"
                            className={labelClassName}
                        >
                            Beneficiary
                        </Label>
                        <Select
                            value={beneficiaryId}
                            onValueChange={setBeneficiaryId}
                        >
                            <SelectTrigger
                                className={`${inputClassName} w-full`}
                            >
                                <SelectValue placeholder="Select a beneficiary" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900">
                                {beneficiaries.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>
                                        {b.firstName} {b.lastName} ({b.email})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Description */}
                    <div>
                        <Label
                            htmlFor="editDescription"
                            className={labelClassName}
                        >
                            Description
                        </Label>
                        <Textarea
                            id="editDescription"
                            className={textareaClassName}
                            placeholder="Enter grant description..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    {/* Restrictions */}
                    <div>
                        <Label
                            htmlFor="editRestrictions"
                            className={labelClassName}
                        >
                            Restrictions
                        </Label>
                        <Textarea
                            id="editRestrictions"
                            className={textareaClassName}
                            placeholder="Enter grant restrictions..."
                            value={restrictions}
                            onChange={(e) => setRestrictions(e.target.value)}
                        />
                    </div>

                    {/* Status */}
                    <div>
                        <Label htmlFor="editStatus" className={labelClassName}>
                            Status
                        </Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger
                                className={`${inputClassName} w-full`}
                            >
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900">
                                <SelectItem value="DRAFT">Draft</SelectItem>
                                <SelectItem value="ACTIVE">Active</SelectItem>
                                <SelectItem value="PAUSED">Paused</SelectItem>
                                <SelectItem value="COMPLETED">Completed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Benefit Flags */}
                    <div>
                        <Label className={labelClassName}>Benefit Flags</Label>
                        <div className="grid grid-cols-2 gap-3 mt-1">
                            {BENEFIT_FLAGS.map((flag) => (
                                <div
                                    key={flag.key}
                                    className="flex items-center gap-2"
                                >
                                    <Checkbox
                                        id={`edit-flag-${flag.key}`}
                                        checked={benefitFlags[flag.key]}
                                        onCheckedChange={() =>
                                            toggleBenefitFlag(flag.key)
                                        }
                                    />
                                    <Label
                                        htmlFor={`edit-flag-${flag.key}`}
                                        className="text-[#4b5563] dark:text-white cursor-pointer"
                                    >
                                        {flag.label}
                                    </Label>
                                </div>
                            ))}
                        </div>
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
            </SheetContent>
        </Sheet>
    );
};

export default EditGrantForm;
