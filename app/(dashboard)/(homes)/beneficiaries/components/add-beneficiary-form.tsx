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
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";

const BENEFIT_PROGRAMS = [
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

const AddBeneficiaryForm = () => {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [dateOfBirth, setDateOfBirth] = useState("");
    const [addressStreet, setAddressStreet] = useState("");
    const [benefitPrograms, setBenefitPrograms] = useState<Record<string, boolean>>({
        ssi: false,
        ssdi: false,
        mediCal: false,
        medicaid: false,
        able: false,
        calFresh: false,
        ihss: false,
    });
    const [emergencyContactName, setEmergencyContactName] = useState("");
    const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
    const [notes, setNotes] = useState("");

    const resetForm = () => {
        setFirstName("");
        setLastName("");
        setEmail("");
        setPhone("");
        setDateOfBirth("");
        setAddressStreet("");
        setBenefitPrograms({
            ssi: false,
            ssdi: false,
            mediCal: false,
            medicaid: false,
            able: false,
            calFresh: false,
            ihss: false,
        });
        setEmergencyContactName("");
        setEmergencyContactPhone("");
        setNotes("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!firstName.trim()) {
            toast.error("First name is required");
            return;
        }
        if (!lastName.trim()) {
            toast.error("Last name is required");
            return;
        }
        if (!email.trim()) {
            toast.error("Email is required");
            return;
        }

        setSubmitting(true);

        try {
            const body: Record<string, unknown> = {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim(),
                role: "beneficiary",
                benefitPrograms,
            };

            if (phone.trim()) {
                body.phone = phone.trim();
            }
            if (dateOfBirth) {
                body.dateOfBirth = dateOfBirth;
            }
            if (addressStreet.trim()) {
                body.addressStreet = addressStreet.trim();
            }
            if (emergencyContactName.trim()) {
                body.emergencyContactName = emergencyContactName.trim();
            }
            if (emergencyContactPhone.trim()) {
                body.emergencyContactPhone = emergencyContactPhone.trim();
            }
            if (notes.trim()) {
                body.notes = notes.trim();
            }

            const res = await fetch("/api/beneficiaries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                const message =
                    errorData?.error || "Failed to create beneficiary";
                toast.error(message);
                return;
            }

            toast.success("Beneficiary added successfully");
            setOpen(false);
            resetForm();
            router.refresh();
        } catch {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const toggleBenefitProgram = (key: string) => {
        setBenefitPrograms((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button>+ Add Beneficiary</Button>
            </SheetTrigger>
            <SheetContent
                side="right"
                className="sm:max-w-lg w-full overflow-y-auto"
            >
                <SheetHeader>
                    <SheetTitle>Add New Beneficiary</SheetTitle>
                </SheetHeader>

                <form
                    onSubmit={handleSubmit}
                    className="flex flex-col gap-4 px-4 pb-4"
                >
                    {/* First Name */}
                    <div>
                        <Label htmlFor="firstName" className={labelClassName}>
                            First Name <span className="text-red-600">*</span>
                        </Label>
                        <Input
                            type="text"
                            id="firstName"
                            className={inputClassName}
                            placeholder="Enter first name"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required
                        />
                    </div>

                    {/* Last Name */}
                    <div>
                        <Label htmlFor="lastName" className={labelClassName}>
                            Last Name <span className="text-red-600">*</span>
                        </Label>
                        <Input
                            type="text"
                            id="lastName"
                            className={inputClassName}
                            placeholder="Enter last name"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            required
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <Label htmlFor="email" className={labelClassName}>
                            Email <span className="text-red-600">*</span>
                        </Label>
                        <Input
                            type="email"
                            id="email"
                            className={inputClassName}
                            placeholder="beneficiary@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <Label htmlFor="phone" className={labelClassName}>
                            Phone
                        </Label>
                        <Input
                            type="tel"
                            id="phone"
                            className={inputClassName}
                            placeholder="(555) 123-4567"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                    </div>

                    {/* Date of Birth */}
                    <div>
                        <Label htmlFor="dateOfBirth" className={labelClassName}>
                            Date of Birth
                        </Label>
                        <Input
                            type="date"
                            id="dateOfBirth"
                            className={inputClassName}
                            value={dateOfBirth}
                            onChange={(e) => setDateOfBirth(e.target.value)}
                        />
                    </div>

                    {/* Address */}
                    <div>
                        <Label
                            htmlFor="addressStreet"
                            className={labelClassName}
                        >
                            Address
                        </Label>
                        <Textarea
                            id="addressStreet"
                            className={textareaClassName}
                            placeholder="Enter full address..."
                            value={addressStreet}
                            onChange={(e) => setAddressStreet(e.target.value)}
                        />
                    </div>

                    {/* Benefit Programs */}
                    <div>
                        <Label className={labelClassName}>Benefit Programs</Label>
                        <div className="grid grid-cols-2 gap-3 mt-1">
                            {BENEFIT_PROGRAMS.map((program) => (
                                <div
                                    key={program.key}
                                    className="flex items-center gap-2"
                                >
                                    <Checkbox
                                        id={`program-${program.key}`}
                                        checked={benefitPrograms[program.key]}
                                        onCheckedChange={() =>
                                            toggleBenefitProgram(program.key)
                                        }
                                    />
                                    <Label
                                        htmlFor={`program-${program.key}`}
                                        className="text-[#4b5563] dark:text-white cursor-pointer"
                                    >
                                        {program.label}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Emergency Contact Name */}
                    <div>
                        <Label
                            htmlFor="emergencyContactName"
                            className={labelClassName}
                        >
                            Emergency Contact Name
                        </Label>
                        <Input
                            type="text"
                            id="emergencyContactName"
                            className={inputClassName}
                            placeholder="Contact full name"
                            value={emergencyContactName}
                            onChange={(e) =>
                                setEmergencyContactName(e.target.value)
                            }
                        />
                    </div>

                    {/* Emergency Contact Phone */}
                    <div>
                        <Label
                            htmlFor="emergencyContactPhone"
                            className={labelClassName}
                        >
                            Emergency Contact Phone
                        </Label>
                        <Input
                            type="tel"
                            id="emergencyContactPhone"
                            className={inputClassName}
                            placeholder="(555) 987-6543"
                            value={emergencyContactPhone}
                            onChange={(e) =>
                                setEmergencyContactPhone(e.target.value)
                            }
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <Label htmlFor="notes" className={labelClassName}>
                            Notes
                        </Label>
                        <Textarea
                            id="notes"
                            className={textareaClassName}
                            placeholder="Additional notes about this beneficiary..."
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
                            {submitting ? "Adding..." : "Add Beneficiary"}
                        </Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
};

export default AddBeneficiaryForm;
