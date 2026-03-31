"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { CloudUpload, FileText, CheckCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

interface AddBeneficiaryFormProps {
    onSuccess?: () => void;
}

const AddBeneficiaryForm = ({ onSuccess }: AddBeneficiaryFormProps = {}) => {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Form state
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [dateOfBirth, setDateOfBirth] = useState("");
    const [addressStreet, setAddressStreet] = useState("");
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
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
    const [documentFiles, setDocumentFiles] = useState<File[]>([]);
    const [documentUploading, setDocumentUploading] = useState(false);

    const resetForm = () => {
        setFirstName("");
        setLastName("");
        setEmail("");
        setPhone("");
        setDateOfBirth("");
        setAddressStreet("");
        setAvatarUrl(null);
        setAvatarPreview(null);
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
        setDocumentFiles([]);
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file");
            return;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image must be under 5MB");
            return;
        }

        // Create preview
        const reader = new FileReader();
        reader.onload = (event) => {
            setAvatarPreview(event.target?.result as string);
        };
        reader.readAsDataURL(file);

        // Upload to /api/users/avatar
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/users/avatar", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const error = await res.json();
                toast.error(error.error || "Failed to upload avatar");
                return;
            }

            const data = await res.json();
            setAvatarUrl(data.avatarUrl);
            toast.success("Avatar uploaded successfully");
        } catch (error) {
            toast.error("Failed to upload avatar");
        } finally {
            setUploading(false);
        }
    };

    const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newFiles: File[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            // Validate file type (PDF only)
            if (file.type !== "application/pdf") {
                toast.error(`${file.name}: Only PDF files are supported`);
                continue;
            }

            // Validate file size (10MB max)
            if (file.size > 10 * 1024 * 1024) {
                toast.error(`${file.name}: File must be under 10MB`);
                continue;
            }

            newFiles.push(file);
        }

        if (newFiles.length > 0) {
            setDocumentFiles((prev) => [...prev, ...newFiles]);
            toast.success(`${newFiles.length} document(s) ready to upload`);
        }
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

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            toast.error("Please enter a valid email address");
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

            // Must be a valid date
            if (isNaN(dob.getTime())) {
                toast.error("Please enter a valid date of birth");
                return;
            }

            // Cannot be in the future
            if (dob > now) {
                toast.error("Date of birth cannot be in the future");
                return;
            }

            // Reasonable age: must be at least 1 year old
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            if (dob > oneYearAgo) {
                toast.error("Beneficiary must be at least 1 year old");
                return;
            }

            // Reasonable age: must not be older than 130 years
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
            if (avatarUrl) {
                body.avatarUrl = avatarUrl;
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

            const beneficiaryData = await res.json();
            const beneficiaryId = beneficiaryData.id;

            // If there are documents, upload them now with the beneficiary ID
            if (documentFiles.length > 0) {
                for (const file of documentFiles) {
                    try {
                        const formData = new FormData();
                        formData.append("file", file);
                        formData.append("entityType", "user");
                        formData.append("entityId", beneficiaryId);
                        formData.append("fileType", "receipt");

                        await fetch("/api/documents", {
                            method: "POST",
                            body: formData,
                        });
                    } catch (error) {
                        console.error(`Failed to upload document ${file.name}:`, error);
                    }
                }
            }

            toast.success("Beneficiary added successfully");
            setOpen(false);
            resetForm();
            router.refresh();
            if (onSuccess) onSuccess();
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
                    {/* Profile Image */}
                    <div>
                        <Label htmlFor="avatar" className={labelClassName}>
                            Profile Image
                        </Label>
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative">
                                {avatarPreview ? (
                                    <img
                                        src={avatarPreview}
                                        alt="Preview"
                                        className="w-24 h-24 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-24 h-24 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
                                        <Upload className="w-8 h-8 text-neutral-400" />
                                    </div>
                                )}
                                <input
                                    type="file"
                                    id="avatar"
                                    accept="image/*"
                                    onChange={handleAvatarChange}
                                    disabled={uploading}
                                    className="absolute inset-0 w-full h-full rounded-full opacity-0 cursor-pointer"
                                />
                            </div>
                            {uploading && (
                                <span className="text-xs text-neutral-500">Uploading...</span>
                            )}
                            {!avatarPreview && (
                                <span className="text-xs text-neutral-600 dark:text-neutral-400 text-center">
                                    Click to upload profile image
                                </span>
                            )}
                        </div>
                    </div>

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

                    {/* Beneficiary Documents */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5" />
                                <CardTitle>Supporting Documents</CardTitle>
                            </div>
                            <CardDescription>
                                Upload PDF files such as benefits letters, assessments, grant awards, or other supporting documents
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Upload Area */}
                            <div className="relative border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg p-6 bg-neutral-50 dark:bg-neutral-900 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                                <input
                                    type="file"
                                    id="documents"
                                    accept=".pdf"
                                    multiple
                                    onChange={handleDocumentUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="text-center pointer-events-none">
                                    <CloudUpload className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                                    <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                        Click to upload or drag and drop
                                    </p>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                        PDF files only • Max 10MB per file
                                    </p>
                                </div>
                            </div>

                            {/* Selected Files List */}
                            {documentFiles.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
                                            Selected Documents ({documentFiles.length})
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        {documentFiles.map((file, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between gap-2 bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <FileText className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                                                    <span className="text-sm text-neutral-700 dark:text-neutral-300 truncate">
                                                        {file.name}
                                                    </span>
                                                </div>
                                                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-500 flex-shrink-0" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

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
