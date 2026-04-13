"use client";

import UsersGridCard from "@/app/(dashboard)/team/users-grid-card";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import CustomSelect from "@/components/shared/custom-select";
import EmptyState from "@/components/shared/empty-state";
import SearchBox from "@/components/shared/search-box";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Plus, UsersRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

interface TeamUser {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    avatarUrl: string | null;
    isActive: boolean;
    createdAt: string;
}

const INVITABLE_ROLES = [
    { value: "nonprofit_staff", label: "Staff" },
    { value: "cpa", label: "CPA" },
    { value: "auditor", label: "Auditor" },
    { value: "attorney", label: "Attorney" },
    { value: "grant_officer", label: "Grant Officer" },
];

const ROLE_FILTER_OPTIONS = [
    { value: "all", label: "All Roles" },
    { value: "nonprofit_admin", label: "Admin" },
    { value: "nonprofit_staff", label: "Staff" },
    { value: "cpa", label: "CPA" },
    { value: "auditor", label: "Auditor" },
    { value: "attorney", label: "Attorney" },
    { value: "grant_officer", label: "Grant Officer" },
];

// Roles that belong on the Team page (exclude beneficiaries and vendors)
const TEAM_ROLES = ["nonprofit_admin", "nonprofit_staff", "cpa", "auditor", "attorney", "grant_officer", "compliance_officer", "support_agent", "billing_admin", "platform_admin"];

const UsersGrid = () => {
    const [users, setUsers] = useState<TeamUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Invite dialog state
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteFirstName, setInviteFirstName] = useState("");
    const [inviteLastName, setInviteLastName] = useState("");
    const [inviteRole, setInviteRole] = useState("nonprofit_staff");
    const [inviting, setInviting] = useState(false);

    const fetchUsers = useCallback((search?: string, role?: string) => {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (role && role !== "all") params.set("role", role);

        fetch(`/api/users?${params.toString()}`)
            .then((r) => r.ok ? r.json() : { users: [] })
            .then((data) => {
                const list = Array.isArray(data) ? data : (data?.users && Array.isArray(data.users) ? data.users : []);
                // Filter to only show internal team roles (not beneficiaries or vendors)
                const teamOnly = role && role !== "all"
                  ? list
                  : list.filter((u: TeamUser) => TEAM_ROLES.includes(u.role));
                setUsers(teamOnly);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetchUsers(value, roleFilter);
        }, 300);
    };

    const handleRoleFilter = (value: string) => {
        setRoleFilter(value);
        fetchUsers(searchQuery, value);
    };

    const handleRefresh = () => {
        fetchUsers(searchQuery, roleFilter);
    };

    const handleInvite = async () => {
        if (!inviteEmail.trim() || !inviteFirstName.trim() || !inviteLastName.trim()) {
            toast.error("Please fill in all fields");
            return;
        }
        setInviting(true);
        try {
            const res = await fetch("/api/users/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: inviteEmail.trim(),
                    firstName: inviteFirstName.trim(),
                    lastName: inviteLastName.trim(),
                    role: inviteRole,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Invite sent successfully");
                setInviteOpen(false);
                setInviteEmail("");
                setInviteFirstName("");
                setInviteLastName("");
                setInviteRole("nonprofit_staff");
                handleRefresh();
            } else {
                toast.error(data.error || "Failed to send invite");
            }
        } catch {
            toast.error("Failed to send invite");
        } finally {
            setInviting(false);
        }
    };

    return (
        <>
            <DashboardBreadcrumb title="Team" text="Team Management" />

            <Card className="card h-full !p-0 !block border-0 overflow-hidden">
                <CardHeader className="border-b border-neutral-200 dark:border-slate-600 !py-4 px-6 flex items-center flex-wrap gap-3 justify-between">
                    <div className="flex items-center flex-wrap gap-3">
                        <span className="text-base font-medium text-neutral-500 dark:text-neutral-300 mb-0">Show</span>
                        <CustomSelect
                            placeholder="All Roles"
                            options={ROLE_FILTER_OPTIONS.map((r) => r.label)}
                            value={ROLE_FILTER_OPTIONS.find((r) => r.value === roleFilter)?.label}
                            onValueChange={(label) => {
                                const found = ROLE_FILTER_OPTIONS.find((r) => r.label === label);
                                handleRoleFilter(found?.value || "all");
                            }}
                        />
                        <div className="relative sm:max-w-[388px] w-full">
                            <Input
                                className={cn("bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 shadow-none focus-visible:ring-0 focus-visible:border-primary border border-slate-300 h-10 pe-6 ps-11 w-full dark:border-slate-600")}
                                placeholder="Search team..."
                                value={searchQuery}
                                onChange={(e) => handleSearchChange(e.target.value)}
                            />
                            <span className="absolute top-[50%] start-0 ms-4 -translate-y-[50%]">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-500 dark:text-white"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                            </span>
                        </div>
                    </div>
                    <Button
                        className={cn(`w-auto h-11`)}
                        onClick={() => setInviteOpen(true)}
                    >
                        <Plus className="w-5 h-5" />
                        Invite Member
                    </Button>
                </CardHeader>

                <CardContent className="card-body p-6">
                    {loading ? (
                        <p className="text-sm text-neutral-500 col-span-full text-center py-8">Loading team...</p>
                    ) : users.length <= 1 ? (
                        <EmptyState
                            icon={UsersRound}
                            title={users.length === 0 ? "No team members found" : "You're flying solo"}
                            message={
                                users.length === 0
                                    ? "No team members match your current filters."
                                    : "Invite staff, auditors, or compliance officers to help manage your organization. They'll get their own login and role-scoped access."
                            }
                            ctaLabel={users.length <= 1 ? "Invite Team Member" : undefined}
                            ctaOnClick={users.length <= 1 ? () => setInviteOpen(true) : undefined}
                        />
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4">
                            <UsersGridCard users={users} onRefresh={handleRefresh} />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Invite Member Dialog */}
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Invite Team Member</DialogTitle>
                        <DialogDescription>
                            Send an invitation to join your organization.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">First Name</label>
                                <Input
                                    placeholder="First name"
                                    value={inviteFirstName}
                                    onChange={(e) => setInviteFirstName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">Last Name</label>
                                <Input
                                    placeholder="Last name"
                                    value={inviteLastName}
                                    onChange={(e) => setInviteLastName(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">Email</label>
                            <Input
                                type="email"
                                placeholder="email@example.com"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">Role</label>
                            <Select value={inviteRole} onValueChange={setInviteRole}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {INVITABLE_ROLES.map((r) => (
                                        <SelectItem key={r.value} value={r.value}>
                                            {r.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setInviteOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleInvite}
                            disabled={inviting}
                        >
                            {inviting ? "Sending..." : "Send Invite"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
export default UsersGrid;
