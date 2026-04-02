"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import FormDatePicker from "@/components/shared/form-date-picker";
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
    SheetTrigger,
} from "@/components/ui/sheet";

interface Beneficiary {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

const GRANT_BLOCK_OPTIONS = [
    { mcc: "5921", label: "Liquor Stores" },
    { mcc: "5813", label: "Bars & Nightclubs" },
    { mcc: "7995", label: "Gambling" },
    { mcc: "5541", label: "Gas Stations" },
    { mcc: "6011", label: "ATM/Cash Withdrawal" },
    { mcc: "5812", label: "Restaurants" },
    { mcc: "5814", label: "Fast Food" },
    { mcc: "5651", label: "Clothing Stores" },
    { mcc: "7832", label: "Entertainment" },
    { mcc: "5912", label: "Pharmacies" },
    { mcc: "7011", label: "Hotels/Lodging" },
    { mcc: "4121", label: "Taxis/Rideshare" },
];

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

const AddGrantForm = () => {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);

    // Form state
    const [name, setName] = useState("");
    const [grantIssuerName, setGrantIssuerName] = useState("");
    const [grantIssuerContact, setGrantIssuerContact] = useState("");
    const [totalAmount, setTotalAmount] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [beneficiaryId, setBeneficiaryId] = useState("");
    const [description, setDescription] = useState("");
    const [restrictions, setRestrictions] = useState("");
    const [status, setStatus] = useState("ACTIVE");
    const [purpose, setPurpose] = useState("");
    const [blockedMCCs, setBlockedMCCs] = useState<string[]>([]);
    const [benefitFlags, setBenefitFlags] = useState<Record<string, boolean>>({
        ssi: false,
        ssdi: false,
        mediCal: false,
        medicaid: false,
        able: false,
        calFresh: false,
        ihss: false,
    });

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

    const resetForm = () => {
        setName("");
        setGrantIssuerName("");
        setGrantIssuerContact("");
        setTotalAmount("");
        setStartDate("");
        setEndDate("");
        setBeneficiaryId("");
        setDescription("");
        setRestrictions("");
        setPurpose("");
        setBlockedMCCs([]);
        setStatus("ACTIVE");
        setBenefitFlags({
            ssi: false,
            ssdi: false,
            mediCal: false,
            medicaid: false,
            able: false,
            calFresh: false,
            ihss: false,
        });
    };

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

        // Validate startDate is not in the past
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = new Date(startDate);
        if (start < today) {
            toast.error("Start date cannot be in the past");
            return;
        }

        // Validate endDate is after startDate
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
            if (purpose.trim()) {
                body.purpose = purpose.trim();
            }
            if (blockedMCCs.length > 0) {
                body.blockedMCCs = blockedMCCs;
            }

            const res = await fetch("/api/grants", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                const message =
                    errorData?.error || "Failed to create grant";
                toast.error(message);
                return;
            }

            toast.success("Grant created successfully");
            setOpen(false);
            resetForm();
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

    const toggleBlockedMCC = (mcc: string) => {
        setBlockedMCCs((prev) =>
            prev.includes(mcc) ? prev.filter((m) => m !== mcc) : [...prev, mcc]
        );
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button>+ Add Grant</Button>
            </SheetTrigger>
            <SheetContent
                side="right"
                className="sm:max-w-lg w-full overflow-y-auto"
            >
                <SheetHeader>
                    <SheetTitle>Add New Grant</SheetTitle>
                </SheetHeader>

                <form
                    onSubmit={handleSubmit}
                    className="flex flex-col gap-4 px-4 pb-4"
                >
                    {/* Grant Name */}
                    <div>
                        <Label htmlFor="grantName" className={labelClassName}>
                            Grant Name <span className="text-red-600">*</span>
                        </Label>
                        <Input
                            type="text"
                            id="grantName"
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
                            htmlFor="grantIssuerName"
                            className={labelClassName}
                        >
                            Grant Issuer Name{" "}
                            <span className="text-red-600">*</span>
                        </Label>
                        <Input
                            type="text"
                            id="grantIssuerName"
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
                            htmlFor="grantIssuerContact"
                            className={labelClassName}
                        >
                            Grant Issuer Contact Email
                        </Label>
                        <Input
                            type="email"
                            id="grantIssuerContact"
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
                            htmlFor="totalAmount"
                            className={labelClassName}
                        >
                            Total Amount{" "}
                            <span className="text-red-600">*</span>
                        </Label>
                        <Input
                            type="number"
                            id="totalAmount"
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
                        <Label htmlFor="startDate" className={labelClassName}>
                            Start Date{" "}
                            <span className="text-red-600">*</span>
                        </Label>
                        <FormDatePicker
                            id="startDate"
                            value={startDate}
                            onChange={setStartDate}
                            placeholder="Select start date"
                        />
                    </div>

                    {/* End Date */}
                    <div>
                        <Label htmlFor="endDate" className={labelClassName}>
                            End Date{" "}
                            <span className="text-red-600">*</span>
                        </Label>
                        <FormDatePicker
                            id="endDate"
                            value={endDate}
                            onChange={setEndDate}
                            placeholder="Select end date"
                        />
                    </div>

                    {/* Beneficiary */}
                    <div>
                        <Label
                            htmlFor="beneficiary"
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
                            htmlFor="description"
                            className={labelClassName}
                        >
                            Description
                        </Label>
                        <Textarea
                            id="description"
                            className={textareaClassName}
                            placeholder="Enter grant description..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    {/* Grant Purpose */}
                    <div>
                        <Label htmlFor="purpose" className={labelClassName}>
                            Grant Purpose
                        </Label>
                        <Input
                            type="text"
                            id="purpose"
                            className={inputClassName}
                            placeholder="e.g., Medical expenses, writing supplies, housing assistance"
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value)}
                        />
                    </div>

                    {/* Blocked Merchant Categories */}
                    <div>
                        <Label className={labelClassName}>
                            Blocked Merchant Categories
                        </Label>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                            Select categories this grant's funds CANNOT be used for
                        </p>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                            {GRANT_BLOCK_OPTIONS.map((opt) => (
                                <div
                                    key={opt.mcc}
                                    className="flex items-center gap-2"
                                >
                                    <Checkbox
                                        id={`block-${opt.mcc}`}
                                        checked={blockedMCCs.includes(opt.mcc)}
                                        onCheckedChange={() =>
                                            toggleBlockedMCC(opt.mcc)
                                        }
                                    />
                                    <Label
                                        htmlFor={`block-${opt.mcc}`}
                                        className="text-[#4b5563] dark:text-white cursor-pointer text-sm"
                                    >
                                        {opt.label}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Restrictions */}
                    <div>
                        <Label
                            htmlFor="restrictions"
                            className={labelClassName}
                        >
                            Restrictions
                        </Label>
                        <Textarea
                            id="restrictions"
                            className={textareaClassName}
                            placeholder="Enter grant restrictions..."
                            value={restrictions}
                            onChange={(e) => setRestrictions(e.target.value)}
                        />
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
                                <SelectItem value="DRAFT">Draft</SelectItem>
                                <SelectItem value="ACTIVE">Active</SelectItem>
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
                                        id={`flag-${flag.key}`}
                                        checked={benefitFlags[flag.key]}
                                        onCheckedChange={() =>
                                            toggleBenefitFlag(flag.key)
                                        }
                                    />
                                    <Label
                                        htmlFor={`flag-${flag.key}`}
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
                            {submitting ? "Creating..." : "Create Grant"}
                        </Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
};

export default AddGrantForm;
