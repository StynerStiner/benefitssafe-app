"use client";

import CommonLink from "@/components/shared/common-link";
import UserAvatar from "@/components/shared/user-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";
import React from "react";

interface UserItem {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    role: string;
}

interface AuditLogItem {
    id: string;
    userId: string;
    action: string;
    createdAt: string;
}

interface TopPodcasterCardProps {
    users: UserItem[];
    auditLogs: AuditLogItem[];
}

const ROLE_LABELS: Record<string, string> = {
    nonprofit_admin: "Admin",
    nonprofit_staff: "Staff",
    platform_admin: "Platform Admin",
    support: "Support",
    beneficiary: "Beneficiary",
    cpa: "CPA",
    auditor: "Auditor",
    attorney: "Attorney",
    vendor: "Vendor",
    grant_officer: "Grant Officer",
    compliance_officer: "Compliance",
    finance_officer: "Finance",
};

// Sort: admins first, then support, then others
const ROLE_PRIORITY: Record<string, number> = {
    nonprofit_admin: 0,
    platform_admin: 1,
    support: 2,
    nonprofit_staff: 3,
    compliance_officer: 4,
    finance_officer: 5,
};

const TopPodcasterCard: React.FC<TopPodcasterCardProps> = ({ users, auditLogs }) => {
    // Calculate rating based on audit log activity count
    const userActivityMap = new Map<string, number>();
    for (const log of auditLogs) {
        userActivityMap.set(log.userId, (userActivityMap.get(log.userId) || 0) + 1);
    }
    const maxActivity = Math.max(1, ...Array.from(userActivityMap.values()));

    const sortedUsers = [...users]
        .sort((a, b) => {
            const pa = ROLE_PRIORITY[a.role] ?? 99;
            const pb = ROLE_PRIORITY[b.role] ?? 99;
            return pa - pb;
        })
        .slice(0, 6);

    const agentsWithRating = sortedUsers.map(user => {
        const activity = userActivityMap.get(user.id) || 0;
        const rating = activity > 0 ? Math.max(1, Math.min(5, (activity / maxActivity) * 5)) : 0;
        return {
            user,
            rating: Math.round(rating * 10) / 10,
            roleLabel: ROLE_LABELS[user.role] || user.role,
        };
    });

    // helper function to render stars dynamically
    const renderStars = (rating: number) => {
        const totalStars = 5;
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 !== 0;

        return Array.from({ length: totalStars }, (_, i) => {
            if (i < fullStars) {
                // filled (yellow) stars
                return <Star key={i} className="w-4 h-4 fill-current text-yellow-500" />;
            } else if (i === fullStars && hasHalfStar) {
                // half star -- use gradient
                return (
                    <span key={i} className="relative w-4 h-4">
                        <Star className="absolute top-0 left-0 w-4 h-4 text-neutral-400" />
                        <Star
                            className="absolute top-0 left-0 w-4 h-4 text-yellow-500"
                            style={{
                                clipPath: "inset(0 50% 0 0)",
                                fill: "currentColor",
                            }}
                        />
                    </span>
                );
            } else {
                // empty (neutral) stars
                return <Star key={i} className="w-4 h-4 text-neutral-400" />;
            }
        });
    };

    return (
        <Card className="card h-full rounded-lg border-0 !p-0">
            <CardContent className="card-body p-0 flex flex-col justify-between gap-8">
                <div>
                    {/* Header */}
                    <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-4 px-6">
                        <div className="flex items-center flex-wrap gap-2 justify-between">
                            <h6 className="font-bold text-lg mb-0">Top Support Agents</h6>
                            <CommonLink />
                        </div>
                    </div>

                    {/* Podcasters List */}
                    <div className="card-body py-4 px-6">
                        {agentsWithRating.length === 0 ? (
                            <div className="text-center text-neutral-500 dark:text-neutral-400 py-4">
                                No data yet
                            </div>
                        ) : (
                            agentsWithRating.map((agent, index) => (
                                <div
                                    key={agent.user.id}
                                    className={`flex items-center justify-between gap-3 ${index === agentsWithRating.length - 1 ? "" : "mb-4"
                                        }`}
                                >
                                    {/* Info */}
                                    <div className="flex items-center">
                                        <UserAvatar
                                            firstName={agent.user.firstName || undefined}
                                            lastName={agent.user.lastName || undefined}
                                            size={40}
                                            className="w-10 h-10 rounded-full flex-shrink-0 me-3 overflow-hidden"
                                        />
                                        <div>
                                            <h6 className="sm:text-base text-xs mb-0 font-medium">
                                                {agent.user.firstName || ""} {agent.user.lastName || ""}
                                            </h6>
                                            <span className="text-sm text-neutral-600 dark:text-neutral-100 font-medium">
                                                {agent.roleLabel}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Rating */}
                                    <div className="text-right">
                                        <div className="flex items-center gap-1.5 justify-end mb-1">
                                            {renderStars(agent.rating)}
                                        </div>
                                        <span className="text-neutral-600 dark:text-neutral-100 text-sm">
                                            {agent.rating.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default TopPodcasterCard;