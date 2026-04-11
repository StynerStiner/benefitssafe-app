"use client";

import AvatarUpload from "@/app/(dashboard)/profile/components/avatar-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    fieldLabels,
    getProfileConfig,
    roleDisplay,
    type ProfileField,
    type ProfileRoleConfig,
} from "@/lib/profile-config";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

type ProfileData = Partial<Record<ProfileField, string>> & {
    id?: string;
    role?: string;
    image?: string;
};

const inputTypeFor = (field: ProfileField): string => {
    if (field === "email") return "email";
    if (field === "phone" || field === "emergencyContactPhone") return "tel";
    return "text";
};

const EditProfileTabContent = () => {
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formValues, setFormValues] = useState<Partial<Record<ProfileField, string>>>({});

    useEffect(() => {
        let cancelled = false;
        fetch("/api/users/profile")
            .then((res) => (res.ok ? res.json() : null))
            .then((data: ProfileData | null) => {
                if (cancelled || !data) return;
                setProfile(data);
                // Seed form values from the loaded profile
                const seed: Partial<Record<ProfileField, string>> = {};
                (Object.keys(data) as (keyof ProfileData)[]).forEach((k) => {
                    if (k === "id" || k === "role" || k === "image") return;
                    const v = data[k];
                    if (typeof v === "string") seed[k as ProfileField] = v;
                });
                setFormValues(seed);
            })
            .catch(() => {
                // Silent fail — form renders empty, user can still type
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const role = profile?.role;
    const config: ProfileRoleConfig = useMemo(() => getProfileConfig(role), [role]);
    const badge = useMemo(() => (role ? roleDisplay[role] : null), [role]);

    const handleChange = (field: ProfileField) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormValues((prev) => ({ ...prev, [field]: e.target.value }));
    };

    const handleCancel = () => {
        // Reset form to last-fetched profile values
        if (!profile) return;
        const seed: Partial<Record<ProfileField, string>> = {};
        (Object.keys(profile) as (keyof ProfileData)[]).forEach((k) => {
            if (k === "id" || k === "role" || k === "image") return;
            const v = profile[k];
            if (typeof v === "string") seed[k as ProfileField] = v;
        });
        setFormValues(seed);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (config.editableFields.length === 0) {
            toast.error("Your role cannot edit profile fields. Only your photo can be updated.");
            return;
        }

        // Build the payload: only editable fields, only if changed
        const payload: Partial<Record<ProfileField, string>> = {};
        for (const field of config.editableFields) {
            const current = formValues[field] ?? "";
            const original = (profile?.[field] as string | undefined) ?? "";
            if (current !== original) {
                payload[field] = current;
            }
        }

        if (Object.keys(payload).length === 0) {
            toast("No changes to save", { icon: "ℹ️" });
            return;
        }

        setSaving(true);
        try {
            const res = await fetch("/api/users/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || "Failed to save profile. Please try again.");
                return;
            }

            const updated = (await res.json()) as ProfileData;
            setProfile(updated);
            toast.success("Profile updated");
        } catch {
            toast.error("Failed to save profile. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="px-4 sm:px-6 pb-6">
                <h3 className="text-base text-neutral-600 dark:text-neutral-200 mb-4">Profile Image</h3>
                <div className="mb-6 mt-4 animate-pulse">
                    <div className="h-[150px] w-[150px] rounded-full bg-slate-200 dark:bg-slate-600" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-x-6 animate-pulse">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="col-span-12 sm:col-span-6 mb-5">
                            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-600 rounded mb-2" />
                            <div className="h-12 w-full bg-slate-200 dark:bg-slate-600 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const renderField = (field: ProfileField, editable: boolean) => {
        const label = fieldLabels[field];
        const value = formValues[field] ?? "";
        const type = inputTypeFor(field);
        const required = editable && (field === "firstName" || field === "lastName" || field === "email");
        const isFullWidth = field === "businessAddress";

        return (
            <div key={field} className={isFullWidth ? "col-span-12" : "col-span-12 sm:col-span-6"}>
                <div className="mb-5">
                    <Label htmlFor={field} className="inline-block font-semibold text-neutral-600 dark:text-neutral-200 text-sm mb-2">
                        {label} {required && <span className="text-red-600">*</span>}
                    </Label>
                    <Input
                        id={field}
                        name={field}
                        type={type}
                        value={value}
                        onChange={handleChange(field)}
                        disabled={!editable || saving}
                        readOnly={!editable}
                        placeholder={editable ? `Enter ${label.toLowerCase()}` : ""}
                        required={required}
                        className={!editable ? "bg-neutral-100 dark:bg-slate-800 cursor-not-allowed" : ""}
                        aria-readonly={!editable}
                    />
                </div>
            </div>
        );
    };

    const visibleFields: Array<{ field: ProfileField; editable: boolean }> = [
        ...config.editableFields.map((f) => ({ field: f, editable: true })),
        ...config.readOnlyFields.map((f) => ({ field: f, editable: false })),
    ];

    return (
        <div className="px-4 sm:px-6 pb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-base text-neutral-600 dark:text-neutral-200 mb-0">Profile Image</h3>
                {badge && (
                    <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${badge.badgeClass}`}
                        aria-label={`Role: ${badge.label}`}
                    >
                        {badge.label}
                    </span>
                )}
            </div>

            <div className="mb-6 mt-4">
                <AvatarUpload />
            </div>

            <form onSubmit={handleSave}>
                {visibleFields.length === 0 ? (
                    <div className="text-sm text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-slate-800 rounded-lg p-4 mb-6 border border-neutral-200 dark:border-slate-600">
                        Your role does not permit editing profile fields. Only your profile photo can be updated — use the camera icon above.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-x-6">
                        {visibleFields.map(({ field, editable }) => renderField(field, editable))}
                    </div>
                )}

                {config.extraSections.length > 0 && (
                    <div className="mb-6 border-t border-neutral-200 dark:border-slate-600 pt-4">
                        <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-3">
                            Administration
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {config.extraSections.map((section) => (
                                <Link
                                    key={section.href}
                                    href={section.href}
                                    className="inline-flex items-center px-4 py-2 rounded-lg border border-primary text-primary hover:bg-primary hover:text-white text-sm font-medium transition-colors min-h-[44px]"
                                >
                                    {section.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {config.editableFields.length > 0 && (
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancel}
                            disabled={saving}
                            className="h-[48px] border border-red-600 bg-transparent hover:bg-red-600/20 text-red-600 text-base px-10 sm:px-14 py-[11px] rounded-lg min-h-[44px]"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={saving}
                            className="h-[48px] text-base px-10 sm:px-14 py-3 rounded-lg min-h-[44px]"
                        >
                            {saving ? "Saving..." : "Save"}
                        </Button>
                    </div>
                )}
            </form>
        </div>
    );
};

export default EditProfileTabContent;
