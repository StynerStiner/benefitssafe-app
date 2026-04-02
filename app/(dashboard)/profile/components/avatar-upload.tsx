
"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DefaultUploadedImage from "@/public/assets/images/user-grid/user-grid-img13.png";
import { Camera, Loader2 } from "lucide-react";
import { StaticImageData } from "next/image";
import React, { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

const AvatarUpload = () => {
    const { data: session, update: updateSession } = useSession();
    const [imagePreview, setImagePreview] = useState<string | StaticImageData>(DefaultUploadedImage);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load current avatar from session on mount
    useEffect(() => {
        if (session?.user?.image) {
            setImagePreview(session.user.image);
        }
    }, [session?.user?.image]);

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);

        // Validate file type
        const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
            setError("Only PNG, JPG, GIF, and WebP images are supported.");
            return;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            setError("Image must be under 5MB.");
            return;
        }

        // Show preview immediately
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);

        // Upload to API
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/users/avatar", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "Upload failed. Please try again.");
                return;
            }

            const data = await res.json();
            // Update the session so the new avatar shows everywhere
            if (data.avatarUrl) {
                await updateSession({ image: data.avatarUrl });
            }
        } catch {
            setError("Upload failed. Please try again.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="avatar-upload">
            <div className="avatar-edit absolute bottom-0 end-0 me-6 mt-4 z-[1] cursor-pointer">
                <Input
                    type="file"
                    id="imageUpload"
                    accept=".png, .jpg, .jpeg, .gif, .webp"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    hidden
                    disabled={uploading}
                />
                <Label
                    htmlFor="imageUpload"
                    className="w-8 h-8 flex justify-center items-center bg-blue-100 dark:bg-primary/25 text-primary dark:text-blue-400 border border-primary hover:bg-blue-100 text-lg rounded-full cursor-pointer"
                >
                    {uploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Camera className="w-4 h-4" />
                    )}
                </Label>
            </div>

            <div className="avatar-preview relative h-[150px] w-[150px] rounded-full border border-[#487FFF] shadow-md">
                <div
                    id="imagePreview"
                    className="h-full w-full rounded-full bg-cover bg-center bg-no-repeat"
                    style={{
                        backgroundImage: `url(${typeof imagePreview === "string" ? imagePreview : imagePreview.src})`,
                    }}
                />
            </div>
            {error && (
                <p className="text-red-500 text-xs mt-2">{error}</p>
            )}
        </div>
    );
};

export default AvatarUpload;
