"use client";

import { useState } from "react";
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
    SheetTrigger,
} from "@/components/ui/sheet";

const inputClassName =
    "border border-neutral-300 px-5 dark:border-slate-500 focus:border-primary dark:focus:border-primary focus-visible:border-primary h-12 rounded-lg !shadow-none !ring-0";

const labelClassName = "text-[#4b5563] dark:text-white mb-2";

const textareaClassName =
    "border border-neutral-300 px-5 dark:border-slate-500 focus:border-primary dark:focus:border-primary focus-visible:border-primary h-[120px] rounded-lg !shadow-none !ring-0";

const AddVendorForm = () => {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [name, setName] = useState("");
    const [type, setType] = useState("SAAS_SUBSCRIPTION");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [website, setWebsite] = useState("");
    const [address, setAddress] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("");
    const [taxIdCollected, setTaxIdCollected] = useState(false);
    const [form1099Required, setForm1099Required] = useState(false);

    const resetForm = () => {
        setName("");
        setType("SAAS_SUBSCRIPTION");
        setEmail("");
        setPhone("");
        setWebsite("");
        setAddress("");
        setPaymentMethod("");
        setTaxIdCollected(false);
        setForm1099Required(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            toast.error("Vendor name is required");
            return;
        }
        if (!email.trim()) {
            toast.error("Email is required");
            return;
        }

        setSubmitting(true);

        try {
            const body: Record<string, unknown> = {
                name: name.trim(),
                type,
                email: email.trim(),
                taxIdCollected,
                form1099Required,
            };

            if (phone.trim()) {
                body.phone = phone.trim();
            }
            if (website.trim()) {
                body.website = website.trim();
            }
            if (address.trim()) {
                body.address = address.trim();
            }
            if (paymentMethod) {
                body.paymentMethod = paymentMethod;
            }

            const res = await fetch("/api/vendors", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                const message =
                    errorData?.error || "Failed to create vendor";
                toast.error(message);
                return;
            }

            toast.success("Vendor created successfully");
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
                <Button>+ Add Vendor</Button>
            </SheetTrigger>
            <SheetContent
                side="right"
                className="sm:max-w-lg w-full overflow-y-auto"
            >
                <SheetHeader>
                    <SheetTitle>Add New Vendor</SheetTitle>
                </SheetHeader>

                <form
                    onSubmit={handleSubmit}
                    className="flex flex-col gap-4 px-4 pb-4"
                >
                    {/* Vendor Name */}
                    <div>
                        <Label htmlFor="vendorName" className={labelClassName}>
                            Vendor Name <span className="text-red-600">*</span>
                        </Label>
                        <Input
                            type="text"
                            id="vendorName"
                            className={inputClassName}
                            placeholder="Enter vendor name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    {/* Type */}
                    <div>
                        <Label htmlFor="vendorType" className={labelClassName}>
                            Type
                        </Label>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger
                                className={`${inputClassName} w-full`}
                            >
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
                        <Label htmlFor="vendorEmail" className={labelClassName}>
                            Email <span className="text-red-600">*</span>
                        </Label>
                        <Input
                            type="email"
                            id="vendorEmail"
                            className={inputClassName}
                            placeholder="vendor@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <Label htmlFor="vendorPhone" className={labelClassName}>
                            Phone
                        </Label>
                        <Input
                            type="tel"
                            id="vendorPhone"
                            className={inputClassName}
                            placeholder="(555) 123-4567"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                    </div>

                    {/* Website */}
                    <div>
                        <Label htmlFor="vendorWebsite" className={labelClassName}>
                            Website
                        </Label>
                        <Input
                            type="url"
                            id="vendorWebsite"
                            className={inputClassName}
                            placeholder="https://vendor.com"
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                        />
                    </div>

                    {/* Address */}
                    <div>
                        <Label htmlFor="vendorAddress" className={labelClassName}>
                            Address
                        </Label>
                        <Textarea
                            id="vendorAddress"
                            className={textareaClassName}
                            placeholder="Enter vendor address..."
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                        />
                    </div>

                    {/* Payment Method */}
                    <div>
                        <Label htmlFor="paymentMethod" className={labelClassName}>
                            Payment Method
                        </Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                            <SelectTrigger
                                className={`${inputClassName} w-full`}
                            >
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

                    {/* Tax ID Collected & 1099 Required */}
                    <div>
                        <Label className={labelClassName}>Tax & Compliance</Label>
                        <div className="grid grid-cols-2 gap-3 mt-1">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="taxIdCollected"
                                    checked={taxIdCollected}
                                    onCheckedChange={(checked) =>
                                        setTaxIdCollected(checked === true)
                                    }
                                />
                                <Label
                                    htmlFor="taxIdCollected"
                                    className="text-[#4b5563] dark:text-white cursor-pointer"
                                >
                                    Tax ID Collected
                                </Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="form1099Required"
                                    checked={form1099Required}
                                    onCheckedChange={(checked) =>
                                        setForm1099Required(checked === true)
                                    }
                                />
                                <Label
                                    htmlFor="form1099Required"
                                    className="text-[#4b5563] dark:text-white cursor-pointer"
                                >
                                    1099 Required
                                </Label>
                            </div>
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="mt-2">
                        <Button
                            type="submit"
                            className="w-full h-12"
                            disabled={submitting}
                        >
                            {submitting ? "Creating..." : "Create Vendor"}
                        </Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
};

export default AddVendorForm;
