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
import Link from "next/link";
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
    memberships?: { id: string; memberCode: string | null; status: string }[];
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

    const handleRevokeMembership = async (user: TeamUser) => {
        const membershipId = user.memberships?.[0]?.id;
        if (!membershipId) {
            toast.error("No membership found for this user");
            return;
        }
        if (!confirm(`Remove ${user.firstName} ${user.lastName} from this organization? Their cards will be frozen.`)) return;
        try {
            const res = await fetch(`/api/memberships/${membershipId}`, { method: "DELETE" });
            const data = await res.json();
            if (res.ok) {
                toast.success(`${user.firstName} removed from organization. ${data.cardsFrozen} card(s) frozen.`);
                onRefresh?.();
            } else {
                toast.error(data.error || "Failed to revoke membership");
            }
        } catch {
            toast.error("Failed to revoke membership");
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
                        <div className="relative border border-neutral-200 dark:border-neutral-600 rounded-xl overflow-hidden">
                            <div className="relative h-[80px]">
                                <Image src={bgImages[index % bgImages.length]} alt="Image" fill className="w-full object-fit-cover" />
                            </div>

                            <div className="dropdown absolute top-0 end-0 me-2 mt-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger className='bg-gradient-to-r from-white/50 w-7 h-7 rounded-lg border border-light-white flex justify-center items-center text-white'>
                                        <EllipsisVertical className="h-4" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => openEdit(userItem)}>Edit</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleRevokeMembership(userItem)}>Remove from Org</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openDelete(userItem)}>Deactivate User</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="px-3 pb-3 text-center relative z-[1]">
                                <UserAvatar firstName={userItem.firstName} lastName={userItem.lastName} avatarUrl={userItem.avatarUrl} size={64} className="border br-white border-width-2-px ms-auto me-auto -mt-[32px]" />
                                <h6 className="text-sm font-semibold mb-0 mt-1">{userItem.firstName} {userItem.lastName}</h6>
                                <span className="text-neutral-500 dark:text-neutral-300 text-xs block truncate">{userItem.email}</span>

                                <div className="flex items-center justify-center gap-2 mt-2">
                                    <Badge variant="info" className="text-xs">{roleLabels[userItem.role] || userItem.role}</Badge>
                                    <Badge variant={userItem.isActive ? "success" : "default"} className="text-xs">
                                        {userItem.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                </div>
                                <Link href={`/team/${userItem.id}`}>
                                  <Button size="sm" className={cn(`bg-blue-50 hover:bg-primary dark:hover:bg-primary hover:text-white dark:hover:text-white dark:bg-primary/25 text-primary dark:text-blue-400 text-xs px-2 py-1.5 rounded-lg flex items-center justify-center mt-2 font-medium gap-1 w-full h-8 cursor-pointer`)}>
                                      View Profile
                                      <ChevronRight className="w-3.5 h-3.5" />
                                  </Button>
                                </Link>
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
