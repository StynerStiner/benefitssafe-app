"use client";

import { useState, useEffect } from "react";
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
} from "@/components/ui/sheet";

interface Beneficiary {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    dateOfBirth: string | null;
    addressStreet: string | null;
    addressCity: string | null;
    addressState: string | null;
    addressZip: string | null;
    benefitPrograms: Record<string, boolean> | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    notes: string | null;
    isActive: boolean;
}

interface EditBeneficiaryFormProps {
    beneficiary: Beneficiary;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

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

const EditBeneficiaryForm = ({
    beneficiary,
    open,
    onOpenChange,
    onSuccess,
}: EditBeneficiaryFormProps) => {
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form state
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phone, setPhone] = useState("");
    const [dateOfBirth, setDateOfBirth] = useState("");
    const [addressStreet, setAddressStreet] = useState("");
    const [addressCity, setAddressCity] = useState("");
    const [addressState, setAddressState] = useState("");
    const [addressZip, setAddressZip] = useState("");
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

    // Fetch full beneficiary profile when sheet opens
    useEffect(() => {
        if (!open || !beneficiary.id) return;

        setLoading(true);
        fetch(`/api/beneficiaries/${beneficiary.id}`)
            .then((r) => {
                if (!r.ok) throw new Error("Failed to load");
                return r.json();
            })
            .then((data) => {
                setFirstName(data.firstName || "");
                setLastName(data.lastName || "");
                setPhone(data.phone || "");
                setDateOfBirth(
                    data.dateOfBirth
                        ? new Date(data.dateOfBirth).toISOString().split("T")[0]
                        : ""
                );
                setAddressStreet(data.addressStreet || "");
                setAddressCity(data.addressCity || "");
                setAddressState(data.addressState || "");
                setAddressZip(data.addressZip || "");
                setBenefitPrograms({
                    ssi: data.benefitPrograms?.ssi || false,
                    ssdi: data.benefitPrograms?.ssdi || false,
                    mediCal: data.benefitPrograms?.mediCal || false,
                    medicaid: data.benefitPrograms?.medicaid || false,
                    able: data.benefitPrograms?.able || false,
                    calFresh: data.benefitPrograms?.calFresh || false,
                    ihss: data.benefitPrograms?.ihss || false,
                });
                setEmergencyContactName(data.emergencyContactName || "");
                setEmergencyContactPhone(data.emergencyContactPhone || "");
                setNotes(data.notes || "");
            })
            .catch(() => {
                toast.error("Failed to load beneficiary details");
            })
            .finally(() => setLoading(false));
    }, [open, beneficiary.id]);

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

        // Validate phone number format (if provided)
        if (phone.trim()) {
            const phoneDigits = phone.trim().replace(/[\s\-\(\)\+\.]/g, "");
            if (!/^\d{7,15}$/.test(phoneDigits)) {
                toast.error("Please enter a valid phone number (7-15 digits)");
                return;
            }
        }

        // Validate date of birth (if provided)
        if (dateOfBirth) {
            const dob = new Date(dateOfBirth);
            const now = new Date();

            if (isNaN(dob.getTime())) {
                toast.error("Please enter a valid date of birth");
                return;
            }
            if (dob > now) {
                toast.error("Date of birth cannot be in the future");
                return;
            }
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            if (dob > oneYearAgo) {
                toast.error("Beneficiary must be at least 1 year old");
                return;
            }
            const maxAge = new Date();
            maxAge.setFullYear(maxAge.getFullYear() - 130);
            if (dob < maxAge) {
                toast.error("Please enter a valid date of birth (age cannot exceed 130 years)");
                return;
            }
        }

        // Validate emergency contact phone format (if provided)
        if (emergencyContactPhone.trim()) {
            const emergencyDigits = emergencyContactPhone.trim().replace(/[\s\-\(\)\+\.]/g, "");
            if (!/^\d{7,15}$/.test(emergencyDigits)) {
                toast.error("Please enter a valid emergency contact phone number (7-15 digits)");
                return;
            }
        }

        setSubmitting(true);

        try {
            const body: Record<string, unknown> = {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                benefitPrograms,
            };

            if (phone.trim()) body.phone = phone.trim();
            else body.phone = "";

            if (dateOfBirth) body.dateOfBirth = dateOfBirth;
            else body.dateOfBirth = "";

            if (addressStreet.trim()) body.addressStreet = addressStreet.trim();
            else body.addressStreet = "";

            if (addressCity.trim()) body.addressCity = addressCity.trim();
            else body.addressCity = "";

            if (addressState.trim()) body.addressState = addressState.trim();
            else body.addressState = "";

            if (addressZip.trim()) body.addressZip = addressZip.trim();
            else body.addressZip = "";

            if (emergencyContactName.trim()) body.emergencyContactName = emergencyContactName.trim();
            else body.emergencyContactName = "";

            if (emergencyContactPhone.trim()) body.emergencyContactPhone = emergencyContactPhone.trim();
            else body.emergencyContactPhone = "";

            if (notes.trim()) body.notes = notes.trim();
            else body.notes = "";

            const res = await fetch(`/api/beneficiaries/${beneficiary.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                const message = errorData?.error || "Failed to update beneficiary";
                toast.error(message);
                return;
            }

            toast.success("Beneficiary updated successfully");
            onOpenChange(false);
            onSuccess();
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
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="sm:max-w-lg w-full overflow-y-auto"
            >
                <SheetHeader>
                    <SheetTitle>Edit Beneficiary</SheetTitle>
                </SheetHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <span className="text-sm text-neutral-500">Loading...</span>
                    </div>
                ) : (
                    <form
                        onSubmit={handleSubmit}
                        className="flex flex-col gap-4 px-4 pb-4"
                    >
                        {/* Email (read-only) */}
                        <div>
                            <Label htmlFor="edit-email" className={labelClassName}>
                                Email
                            </Label>
                            <Input
                                type="email"
                                id="edit-email"
                                className={`${inputClassName} bg-neutral-100 dark:bg-neutral-800 cursor-not-allowed`}
                                value={beneficiary.email}
                                readOnly
                                disabled
                            />
                        </div>

                        {/* First Name */}
                        <div>
                            <Label htmlFor="edit-firstName" className={labelClassName}>
                                First Name <span className="text-red-600">*</span>
                            </Label>
                            <Input
                                type="text"
                                id="edit-firstName"
                                className={inputClassName}
                                placeholder="Enter first name"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                required
                            />
                        </div>

                        {/* Last Name */}
                        <div>
                            <Label htmlFor="edit-lastName" className={labelClassName}>
                                Last Name <span className="text-red-600">*</span>
                            </Label>
                            <Input
                                type="text"
                                id="edit-lastName"
                                className={inputClassName}
                                placeholder="Enter last name"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                required
                            />
                        </div>

                        {/* Phone */}
                        <div>
                            <Label htmlFor="edit-phone" className={labelClassName}>
                                Phone
                            </Label>
                            <Input
                                type="tel"
                                id="edit-phone"
                                className={inputClassName}
                                placeholder="(555) 123-4567"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                        </div>

                        {/* Date of Birth */}
                        <div>
                            <Label htmlFor="edit-dateOfBirth" className={labelClassName}>
                                Date of Birth
                            </Label>
                            <Input
                                type="date"
                                id="edit-dateOfBirth"
                                className={inputClassName}
                                value={dateOfBirth}
                                onChange={(e) => setDateOfBirth(e.target.value)}
                            />
                        </div>

                        {/* Address Street */}
                        <div>
                            <Label htmlFor="edit-addressStreet" className={labelClassName}>
                                Street Address
                            </Label>
                            <Textarea
                                id="edit-addressStreet"
                                className={textareaClassName}
                                placeholder="Enter street address..."
                                value={addressStreet}
                                onChange={(e) => setAddressStreet(e.target.value)}
                            />
                        </div>

                        {/* Address City */}
                        <div>
                            <Label htmlFor="edit-addressCity" className={labelClassName}>
                                City
                            </Label>
                            <Input
                                type="text"
                                id="edit-addressCity"
                                className={inputClassName}
                                placeholder="City"
                                value={addressCity}
                                onChange={(e) => setAddressCity(e.target.value)}
                            />
                        </div>

                        {/* Address State */}
                        <div>
                            <Label htmlFor="edit-addressState" className={labelClassName}>
                                State
                            </Label>
                            <Input
                                type="text"
                                id="edit-addressState"
                                className={inputClassName}
                                placeholder="CA"
                                maxLength={2}
                                value={addressState}
                                onChange={(e) => setAddressState(e.target.value)}
                            />
                        </div>

                        {/* Address Zip */}
                        <div>
                            <Label htmlFor="edit-addressZip" className={labelClassName}>
                                ZIP Code
                            </Label>
                            <Input
                                type="text"
                                id="edit-addressZip"
                                className={inputClassName}
                                placeholder="90210"
                                maxLength={10}
                                value={addressZip}
                                onChange={(e) => setAddressZip(e.target.value)}
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
                                            id={`edit-program-${program.key}`}
                                            checked={benefitPrograms[program.key]}
                                            onCheckedChange={() =>
                                                toggleBenefitProgram(program.key)
                                            }
                                        />
                                        <Label
                                            htmlFor={`edit-program-${program.key}`}
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
                                htmlFor="edit-emergencyContactName"
                                className={labelClassName}
                            >
                                Emergency Contact Name
                            </Label>
                            <Input
                                type="text"
                                id="edit-emergencyContactName"
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
                                htmlFor="edit-emergencyContactPhone"
                                className={labelClassName}
                            >
                                Emergency Contact Phone
                            </Label>
                            <Input
                                type="tel"
                                id="edit-emergencyContactPhone"
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
                            <Label htmlFor="edit-notes" className={labelClassName}>
                                Notes
                            </Label>
                            <Textarea
                                id="edit-notes"
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
                                {submitting ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    </form>
                )}
            </SheetContent>
        </Sheet>
    );
};

export default EditBeneficiaryForm;
