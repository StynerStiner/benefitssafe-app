"use client";

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { ChevronRight, EllipsisVertical } from "lucide-react";
import Image, { StaticImageData } from "next/image";
import { useState } from "react";
import toast from "react-hot-toast";
import UserAvatar from "@/components/shared/user-avatar";

import UserGridBg1 from "@/public/assets/images/user-grid/user-grid-bg1.png";
import UserGridBg10 from "@/public/assets/images/user-grid/user-grid-bg10.png";
import UserGridBg11 from "@/public/assets/images/user-grid/user-grid-bg11.png";
import UserGridBg12 from "@/public/assets/images/user-grid/user-grid-bg12.png";
import UserGridBg2 from "@/public/assets/images/user-grid/user-grid-bg2.png";
import UserGridBg3 from "@/public/assets/images/user-grid/user-grid-bg3.png";
import UserGridBg4 from "@/public/assets/images/user-grid/user-grid-bg4.png";
import UserGridBg5 from "@/public/assets/images/user-grid/user-grid-bg5.png";
import UserGridBg6 from "@/public/assets/images/user-grid/user-grid-bg6.png";
import UserGridBg7 from "@/public/assets/images/user-grid/user-grid-bg7.png";
import UserGridBg8 from "@/public/assets/images/user-grid/user-grid-bg8.png";
import UserGridBg9 from "@/public/assets/images/user-grid/user-grid-bg9.png";

interface TeamUser {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    phone?: string;
    avatarUrl: string | null;
    isActive: boolean;
}

interface UsersGridCardProps {
    users: TeamUser[];
    onRefresh?: () => void;
}

// Template's original bg/avatar image pools for cycling
const bgImages: StaticImageData[] = [UserGridBg1, UserGridBg2, UserGridBg3, UserGridBg4, UserGridBg5, UserGridBg6, UserGridBg7, UserGridBg8, UserGridBg9, UserGridBg10, UserGridBg11, UserGridBg12];

const roleLabels: Record<string, string> = {
    nonprofit_admin: "Admin",
    nonprofit_staff: "Staff",
    beneficiary: "Beneficiary",
    cpa: "CPA",
    auditor: "Auditor",
    attorney: "Attorney",
    grant_officer: "Grant Officer",
    vendor: "Vendor",
    platform_admin: "Platform Admin",
    support_agent: "Support",
    compliance_officer: "Compliance",
    billing_admin: "Billing",
};

const EDITABLE_ROLES = [
    { value: "nonprofit_admin", label: "Admin" },
    { value: "nonprofit_staff", label: "Staff" },
    { value: "beneficiary", label: "Beneficiary" },
    { value: "cpa", label: "CPA" },
    { value: "auditor", label: "Auditor" },
    { value: "attorney", label: "Attorney" },
    { value: "grant_officer", label: "Grant Officer" },
    { value: "vendor", label: "Vendor" },
];

const UsersGridCard = ({ users, onRefresh }: UsersGridCardProps) => {
    // Edit dialog state
    const [editOpen, setEditOpen] = useState(false);
    const [editUser, setEditUser] = useState<TeamUser | null>(null);
    const [editFirstName, setEditFirstName] = useState("");
    const [editLastName, setEditLastName] = useState("");
    const [editRole, setEditRole] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [saving, setSaving] = useState(false);

    // Delete confirmation dialog state
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteUser, setDeleteUser] = useState<TeamUser | null>(null);
    const [deleting, setDeleting] = useState(false);

    const openEdit = (user: TeamUser) => {
        setEditUser(user);
        setEditFirstName(user.firstName);
        setEditLastName(user.lastName);
        setEditRole(user.role);
        setEditPhone(user.phone || "");
        setEditOpen(true);
    };

    const handleEdit = async () => {
        if (!editUser) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/users/${editUser.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    firstName: editFirstName.trim(),
                    lastName: editLastName.trim(),
                    role: editRole,
                    phone: editPhone.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("User updated");
                setEditOpen(false);
                onRefresh?.();
            } else {
                toast.error(data.error || "Failed to update user");
            }
        } catch {
            toast.error("Failed to update user");
        } finally {
            setSaving(false);
        }
    };

    const openDelete = (user: TeamUser) => {
        setDeleteUser(user);
        setDeleteOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteUser) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/users/${deleteUser.id}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("User deactivated");
                setDeleteOpen(false);
                onRefresh?.();
            } else {
                toast.error(data.error || "Failed to deactivate user");
            }
        } catch {
            toast.error("Failed to deactivate user");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
            {users.map((userItem, index) => {
                return (
                    <div className="user-grid-card" key={userItem.id}>
                        <div className="relative border border-neutral-200 dark:border-neutral-600 rounded-2xl overflow-hidden">
                            <div className="relative h-[127px]">
                                <Image src={bgImages[index % bgImages.length]} alt="Image" fill className="w-full object-fit-cover" />

                            </div>

                            <div className="dropdown absolute top-0 end-0 me-4 mt-4">
                                <DropdownMenu>
                                    <DropdownMenuTrigger className='bg-gradient-to-r from-white/50 w-8 h-8 rounded-lg border border-light-white flex justify-center items-center text-white'>
                                        <EllipsisVertical className="h-5" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => openEdit(userItem)}>Edit</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openDelete(userItem)}>Delete</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="pe-6 pb-4 ps-6 text-center mt--50 relative z-[1]">
                                <UserAvatar firstName={userItem.firstName} lastName={userItem.lastName} avatarUrl={userItem.avatarUrl} size={100} className="border br-white border-width-2-px ms-auto me-auto -mt-[50px]" />
                                <h6 className="text-lg mb-0 mt-1.5">{userItem.firstName} {userItem.lastName}</h6>
                                <span className="text-neutral-500 dark:text-neutral-300 mb-4">{userItem.email}</span>

                                <div className="center-border relative bg-gradient-to-r from-red-500/10 to-red-50/25 rounded-lg p-3 flex items-center gap-4 before:absolute before:w-px before:h-full before:z-[1] before:bg-neutral-200 dark:before:bg-neutral-500 before:start-1/2">
                                    <div className="text-center w-1/2">
                                        <h6 className="text-base mb-0">{roleLabels[userItem.role] || userItem.role}</h6>
                                        <span className="text-neutral-500 dark:text-neutral-300 text-sm mb-0">Role</span>
                                    </div>
                                    <div className="text-center w-1/2">
                                        <Badge variant={userItem.isActive ? "success" : "default"}>
                                            {userItem.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                        <span className="text-neutral-500 dark:text-neutral-300 text-sm mb-0">Status</span>
                                    </div>
                                </div>
                                <Button className={cn(`bg-blue-50 hover:bg-primary dark:hover:bg-primary hover:text-white dark:hover:text-white dark:bg-primary/25 text-primary dark:text-blue-400 text-sm px-3 py-3 rounded-lg flex items-center justify-center mt-4 font-medium gap-2 w-full h-12`)}>
                                    View Profile
                                    <ChevronRight className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            })}

            {/* Edit User Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Team Member</DialogTitle>
                        <DialogDescription>
                            Update details for {editUser?.firstName} {editUser?.lastName}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">First Name</label>
                                <Input
                                    value={editFirstName}
                                    onChange={(e) => setEditFirstName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">Last Name</label>
                                <Input
                                    value={editLastName}
                                    onChange={(e) => setEditLastName(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">Role</label>
                            <Select value={editRole} onValueChange={setEditRole}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {EDITABLE_ROLES.map((r) => (
                                        <SelectItem key={r.value} value={r.value}>
                                            {r.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">Phone</label>
                            <Input
                                value={editPhone}
                                onChange={(e) => setEditPhone(e.target.value)}
                                placeholder="Optional"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleEdit} disabled={saving}>
                            {saving ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Deactivate Team Member</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to deactivate {deleteUser?.firstName} {deleteUser?.lastName}? They will no longer be able to access the platform.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleting}
                        >
                            {deleting ? "Deactivating..." : "Deactivate"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default UsersGridCard;
