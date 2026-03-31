"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const inputClassName =
    "border border-neutral-300 px-5 dark:border-slate-500 focus:border-primary dark:focus:border-primary focus-visible:border-primary h-12 rounded-lg !shadow-none !ring-0";

const labelClassName = "text-[#4b5563] dark:text-white mb-2";

const textareaClassName =
    "border border-neutral-300 px-5 dark:border-slate-500 focus:border-primary dark:focus:border-primary focus-visible:border-primary h-[120px] rounded-lg !shadow-none !ring-0";

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

interface EditVendorFormProps {
    vendor: Vendor | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

const EditVendorForm = ({ vendor, open, onOpenChange, onSuccess }: EditVendorFormProps) => {
    const [submitting, setSubmitting] = useState(false);

    const [name, setName] = useState("");
    const [type, setType] = useState("SAAS_SUBSCRIPTION");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [website, setWebsite] = useState("");
    const [address, setAddress] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("");
    const [notes, setNotes] = useState("");

    useEffect(() => {
        if (vendor) {
            setName(vendor.name || "");
            setType(vendor.type || "SAAS_SUBSCRIPTION");
            setEmail(vendor.email || "");
            setPhone(vendor.phone || "");
            setWebsite(vendor.website || "");
            setAddress(vendor.address || "");
            setPaymentMethod(vendor.paymentMethod || "");
            setNotes(vendor.notes || "");
        }
    }, [vendor]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!vendor) return;

        if (!name.trim()) {
            toast.error("Vendor name is required");
            return;
        }

        setSubmitting(true);

        try {
            const body: Record<string, unknown> = {
                name: name.trim(),
                type,
            };

            if (email.trim()) body.email = email.trim();
            if (phone.trim()) body.phone = phone.trim();
            if (website.trim()) body.website = website.trim();
            if (address.trim()) body.address = address.trim();
            if (paymentMethod) body.paymentMethod = paymentMethod;
            if (notes.trim()) body.notes = notes.trim();

            const res = await fetch(`/api/vendors/${vendor.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                const message = errorData?.error || "Failed to update vendor";
                toast.error(message);
                return;
            }

            toast.success("Vendor updated successfully");
            onOpenChange(false);
            onSuccess();
        } catch {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="sm:max-w-lg w-full overflow-y-auto"
            >
                <SheetHeader>
                    <SheetTitle>Edit Vendor</SheetTitle>
                </SheetHeader>

                <form
                    onSubmit={handleSubmit}
                    className="flex flex-col gap-4 px-4 pb-4"
                >
                    {/* Vendor Name */}
                    <div>
                        <Label htmlFor="editVendorName" className={labelClassName}>
                            Vendor Name <span className="text-red-600">*</span>
                        </Label>
                        <Input
                            type="text"
                            id="editVendorName"
                            className={inputClassName}
                            placeholder="Enter vendor name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    {/* Type */}
                    <div>
                        <Label htmlFor="editVendorType" className={labelClassName}>
                            Type
                        </Label>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger className={`${inputClassName} w-full`}>
                                <SelectValue placeholder="Select vendor type" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900">
                                <SelectItem value="SAAS_SUBSCRIPTION">SaaS Subscription</SelectItem>
                                <SelectItem value="SERVICE_PROVIDER">Service Provider</SelectItem>
                                <SelectItem value="ONE_TIME_VENDOR">One-Time Vendor</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Email */}
                    <div>
                        <Label htmlFor="editVendorEmail" className={labelClassName}>
                            Email
                        </Label>
                        <Input
                            type="email"
                            id="editVendorEmail"
                            className={inputClassName}
                            placeholder="vendor@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <Label htmlFor="editVendorPhone" className={labelClassName}>
                            Phone
                        </Label>
                        <Input
                            type="tel"
                            id="editVendorPhone"
                            className={inputClassName}
                            placeholder="(555) 123-4567"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                    </div>

                    {/* Website */}
                    <div>
                        <Label htmlFor="editVendorWebsite" className={labelClassName}>
                            Website
                        </Label>
                        <Input
                            type="url"
                            id="editVendorWebsite"
                            className={inputClassName}
                            placeholder="https://vendor.com"
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                        />
                    </div>

                    {/* Address */}
                    <div>
                        <Label htmlFor="editVendorAddress" className={labelClassName}>
                            Address
                        </Label>
                        <Textarea
                            id="editVendorAddress"
                            className={textareaClassName}
                            placeholder="Enter vendor address..."
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                        />
                    </div>

                    {/* Payment Method */}
                    <div>
                        <Label htmlFor="editPaymentMethod" className={labelClassName}>
                            Payment Method
                        </Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                            <SelectTrigger className={`${inputClassName} w-full`}>
                                <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900">
                                <SelectItem value="card">Card</SelectItem>
                                <SelectItem value="ach">ACH</SelectItem>
                                <SelectItem value="check">Check</SelectItem>
                                <SelectItem value="wire">Wire</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Notes */}
                    <div>
                        <Label htmlFor="editVendorNotes" className={labelClassName}>
                            Notes
                        </Label>
                        <Textarea
                            id="editVendorNotes"
                            className={textareaClassName}
                            placeholder="Any additional notes..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
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
            </SheetContent>
        </Sheet>
    );
};

export default EditVendorForm;
