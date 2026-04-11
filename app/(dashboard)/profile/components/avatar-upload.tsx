"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { getCroppedImageBlob, type CropArea } from "@/lib/crop-image";
import DefaultUploadedImage from "@/public/assets/images/user-grid/user-grid-img13.png";
import { Camera, Loader2, Pencil, Upload } from "lucide-react";
import { useSession } from "next-auth/react";
import { StaticImageData } from "next/image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import toast from "react-hot-toast";

const AvatarUpload = () => {
    const { update: updateSession } = useSession();
    const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
    const [imagePreview, setImagePreview] = useState<string | StaticImageData>(DefaultUploadedImage);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Cropper dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [sourceImage, setSourceImage] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedArea, setCroppedArea] = useState<CropArea | null>(null);

    const hasExistingImage = Boolean(currentImageUrl);

    // Load current avatar from /api/users/profile (authoritative — reads DB directly).
    // Session JWT is stale across reloads because the jwt callback doesn't re-read the DB,
    // so we fetch from the profile API which the view sidebar also uses.
    useEffect(() => {
        let cancelled = false;
        fetch("/api/users/profile")
            .then((res) => (res.ok ? res.json() : null))
            .then((data: { image?: string } | null) => {
                if (cancelled || !data?.image) return;
                setCurrentImageUrl(data.image);
                setImagePreview(data.image);
            })
            .catch(() => {
                // Silent fail — widget falls back to default placeholder
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedArea(croppedAreaPixels);
    }, []);

    const resetCropState = () => {
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCroppedArea(null);
    };

    const openFilePicker = () => {
        fileInputRef.current?.click();
    };

    const handleEditCurrent = async () => {
        if (!currentImageUrl) return;
        setError(null);

        // Fetch the existing image as a blob and convert to data URL.
        // This sidesteps canvas tainting from cross-origin S3 URLs by letting
        // the browser fetch the bytes first, then the <Image> in the cropper
        // reads from a local data URL (same-origin equivalent for canvas).
        try {
            const res = await fetch(currentImageUrl, { cache: "no-store" });
            if (!res.ok) throw new Error("Failed to load current photo");
            const blob = await res.blob();
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error("Failed to read image"));
                reader.readAsDataURL(blob);
            });
            setSourceImage(dataUrl);
            resetCropState();
            setDialogOpen(true);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Could not load current photo";
            setError(message);
            toast.error(message);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        // Read file as data URL and open cropper dialog
        const reader = new FileReader();
        reader.onloadend = () => {
            setSourceImage(reader.result as string);
            resetCropState();
            setDialogOpen(true);
        };
        reader.readAsDataURL(file);

        // Reset file input so the same file can be selected again after cancel
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleCancel = () => {
        setDialogOpen(false);
        setSourceImage(null);
        setCroppedArea(null);
    };

    const handleSaveCrop = async () => {
        if (!sourceImage || !croppedArea) {
            setError("Please adjust the crop area before saving.");
            return;
        }

        setUploading(true);
        setError(null);

        try {
            const blob = await getCroppedImageBlob(sourceImage, croppedArea);

            const formData = new FormData();
            formData.append("file", blob, "avatar.jpg");

            const res = await fetch("/api/users/avatar", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.error || "Upload failed. Please try again.");
                toast.error(data.error || "Upload failed. Please try again.");
                return;
            }

            const data = await res.json();
            if (data.avatarUrl) {
                setCurrentImageUrl(data.avatarUrl);
                setImagePreview(data.avatarUrl);
                // Best-effort session update for same-tab header/sidebar refresh.
                // Authoritative source is /api/users/profile, which we re-read on mount.
                await updateSession({ image: data.avatarUrl });
                toast.success("Profile photo updated");
            }

            setDialogOpen(false);
            setSourceImage(null);
            setCroppedArea(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Upload failed. Please try again.";
            setError(message);
            toast.error(message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="avatar-upload">
            <div className="avatar-edit absolute bottom-0 end-0 me-6 mt-4 z-[1]">
                <Input
                    type="file"
                    id="imageUpload"
                    accept=".png, .jpg, .jpeg, .gif, .webp"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    hidden
                    disabled={uploading}
                />
                {hasExistingImage ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                aria-label="Change profile image"
                                disabled={uploading}
                                className="w-8 h-8 flex justify-center items-center bg-blue-100 dark:bg-primary/25 text-primary dark:text-blue-400 border border-primary hover:bg-blue-200 rounded-full cursor-pointer disabled:opacity-50"
                            >
                                {uploading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Camera className="w-4 h-4" />
                                )}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={openFilePicker} className="cursor-pointer min-h-[44px]">
                                <Upload className="w-4 h-4 mr-2" />
                                Upload New Photo
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleEditCurrent} className="cursor-pointer min-h-[44px]">
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit Current Photo
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <button
                        type="button"
                        onClick={openFilePicker}
                        aria-label="Upload profile image"
                        disabled={uploading}
                        className="w-8 h-8 flex justify-center items-center bg-blue-100 dark:bg-primary/25 text-primary dark:text-blue-400 border border-primary hover:bg-blue-200 rounded-full cursor-pointer disabled:opacity-50"
                    >
                        {uploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Camera className="w-4 h-4" />
                        )}
                    </button>
                )}
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

            <Dialog open={dialogOpen} onOpenChange={(open) => { if (!uploading) { if (!open) handleCancel(); else setDialogOpen(open); } }}>
                <DialogContent
                    className="p-0 gap-0 w-screen h-[100dvh] max-w-full rounded-none sm:w-full sm:h-auto sm:max-w-[600px] sm:rounded-lg flex flex-col"
                    onInteractOutside={(e) => { if (uploading) e.preventDefault(); }}
                    onEscapeKeyDown={(e) => { if (uploading) e.preventDefault(); }}
                >
                    <DialogHeader className="px-4 py-3 sm:px-6 sm:py-4 border-b">
                        <DialogTitle>Adjust Your Photo</DialogTitle>
                        <DialogDescription>
                            Drag to reposition. Use the slider to zoom.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="relative h-[60vh] sm:h-[400px] bg-neutral-900">
                        {sourceImage && (
                            <Cropper
                                image={sourceImage}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                cropShape="round"
                                showGrid={false}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropComplete}
                            />
                        )}
                    </div>

                    <div className="px-4 py-3 sm:px-6 sm:py-4 border-t space-y-3">
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-neutral-500 shrink-0">1x</span>
                            <input
                                type="range"
                                min={1}
                                max={3}
                                step={0.01}
                                value={zoom}
                                onChange={(e) => setZoom(Number(e.target.value))}
                                aria-label="Zoom"
                                className="w-full h-11 accent-primary cursor-pointer"
                                disabled={uploading}
                            />
                            <span className="text-xs text-neutral-500 shrink-0">3x</span>
                        </div>
                    </div>

                    <DialogFooter className="px-4 py-3 sm:px-6 sm:py-4 border-t gap-2 flex-row justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancel}
                            disabled={uploading}
                            className="min-h-[44px] flex-1 sm:flex-initial"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSaveCrop}
                            disabled={uploading || !croppedArea}
                            className="min-h-[44px] flex-1 sm:flex-initial"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    Saving...
                                </>
                            ) : (
                                "Save"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AvatarUpload;
