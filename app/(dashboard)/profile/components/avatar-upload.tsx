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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCroppedImageBlob, type CropArea } from "@/lib/crop-image";
import DefaultUploadedImage from "@/public/assets/images/user-grid/user-grid-img13.png";
import { Camera, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { StaticImageData } from "next/image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import toast from "react-hot-toast";

const AvatarUpload = () => {
    const { data: session, update: updateSession } = useSession();
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

    // Load current avatar from session on mount
    useEffect(() => {
        if (session?.user?.image) {
            setImagePreview(session.user.image);
        }
    }, [session?.user?.image]);

    const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedArea(croppedAreaPixels);
    }, []);

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
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setCroppedArea(null);
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
                setImagePreview(data.avatarUrl);
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
            <div className="avatar-edit absolute bottom-0 end-0 me-6 mt-4 z-[1] cursor-pointer">
                <Input
                    type="file"
                    id="imageUpload"
                    accept=".png, .jpg, .jpeg, .gif, .webp"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    hidden
                    disabled={uploading}
                />
                <Label
                    htmlFor="imageUpload"
                    className="w-8 h-8 flex justify-center items-center bg-blue-100 dark:bg-primary/25 text-primary dark:text-blue-400 border border-primary hover:bg-blue-100 text-lg rounded-full cursor-pointer"
                    aria-label="Upload profile image"
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

            <Dialog open={dialogOpen} onOpenChange={(open) => { if (!uploading) { if (!open) handleCancel(); else setDialogOpen(open); } }}>
                <DialogContent
                    className="p-0 gap-0 w-screen h-[100dvh] max-w-full rounded-none sm:w-full sm:h-auto sm:max-w-[500px] sm:rounded-lg flex flex-col"
                    onInteractOutside={(e) => { if (uploading) e.preventDefault(); }}
                    onEscapeKeyDown={(e) => { if (uploading) e.preventDefault(); }}
                >
                    <DialogHeader className="px-4 py-3 sm:px-6 sm:py-4 border-b">
                        <DialogTitle>Adjust Your Photo</DialogTitle>
                        <DialogDescription>
                            Drag to reposition. Use the slider to zoom.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="relative flex-1 sm:h-[320px] bg-neutral-900">
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
