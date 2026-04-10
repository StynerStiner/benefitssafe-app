"use client"

import { Button } from "@/components/ui/button";
import { useEmailSidebar } from '@/contexts/email-sidebar-context';
import { cn } from "@/lib/utils";
import { CirclePlus, Mail, Pencil, Send, Star, Trash2, TriangleAlert } from 'lucide-react';

interface Notification {
    id: string;
    read: boolean;
    type: string;
}

interface EmailSidebarProps {
    notifications?: Notification[];
    filter?: string;
    onFilterChange?: (filter: string) => void;
    onMarkAllRead?: () => void;
}

const EmailSidebar = ({ notifications = [], filter = "all", onFilterChange, onMarkAllRead }: EmailSidebarProps) => {
    const { isSidebarOpen } = useEmailSidebar();

    const totalCount = notifications.length;
    const unreadCount = notifications.filter((n) => !n.read).length;
    const readCount = notifications.filter((n) => n.read).length;

    const handleFilter = (f: string) => {
        if (onFilterChange) onFilterChange(f);
    };

    return (
        <div className={cn(
            "email-sidebar card h-full p-0 border-0 absolute left-0 top-0 z-[10] xl:static w-[280px] xl:w-auto",
            isSidebarOpen ? "block" : "hidden xl:block"
        )}>
            <div className="card-body p-0">
                <Button className={cn(`w-full rounded-lg flex items-center justify-start gap-2 h-11`)} onClick={onMarkAllRead}>
                    <CirclePlus className="w-4.5" />
                    Mark All Read
                </Button>

                <div className="mt-4">
                    <ul>
                        <li className={filter === "all" ? "item-active mb-1.5" : "mb-1.5"}>
                            <button onClick={() => handleFilter("all")} className="hover:bg-blue-50 dark:hover:bg-slate-700 group hover:text-neutral-900 px-2.5 py-2.5 w-full rounded-lg text-neutral-600 dark:text-white flex items-center">
                                <span className="flex items-center gap-2.5 justify-between w-full">
                                    <span className="flex items-center gap-2.5">
                                        <span className="icon text-2xl line-height-1 flex group-hover:text-primary dark:group-hover:text-white">
                                            <Mail className="w-4" />
                                        </span>
                                        <span className="font-semibold">All Notifications</span>
                                    </span>
                                    <span className="font-medium">{totalCount}</span>
                                </span>
                            </button>
                        </li>
                        <li className={filter === "important" ? "item-active mb-1.5" : "mb-1.5"}>
                            <button onClick={() => handleFilter("important")} className="hover:bg-blue-50 dark:hover:bg-slate-700 group hover:text-neutral-900 px-2.5 py-2.5 w-full rounded-lg text-neutral-600 dark:text-white flex items-center">
                                <span className="flex items-center gap-2.5 justify-between w-full">
                                    <span className="flex items-center gap-2.5">
                                        <span className="icon text-2xl line-height-1 flex group-hover:text-primary dark:group-hover:text-white">
                                            <Star className="w-4" />
                                        </span>
                                        <span className="font-semibold">Important</span>
                                    </span>
                                    <span className="font-medium">{notifications.filter((n) => n.type === "compliance_alert").length}</span>
                                </span>
                            </button>
                        </li>
                        <li className={filter === "read" ? "item-active mb-1.5" : "mb-1.5"}>
                            <button onClick={() => handleFilter("read")} className="hover:bg-blue-50 dark:hover:bg-slate-700 group hover:text-neutral-900 px-2.5 py-2.5 w-full rounded-lg text-neutral-600 dark:text-white flex items-center">
                                <span className="flex items-center gap-2.5 justify-between w-full">
                                    <span className="flex items-center gap-2.5">
                                        <span className="icon text-2xl line-height-1 flex group-hover:text-primary dark:group-hover:text-white">
                                            <Send className="w-4" />
                                        </span>
                                        <span className="font-semibold">Read</span>
                                    </span>
                                    <span className="font-medium">{readCount}</span>
                                </span>
                            </button>
                        </li>
                        <li className={filter === "unread" ? "item-active mb-1.5" : "mb-1.5"}>
                            <button onClick={() => handleFilter("unread")} className="hover:bg-blue-50 dark:hover:bg-slate-700 group hover:text-neutral-900 px-2.5 py-2.5 w-full rounded-lg text-neutral-600 dark:text-white flex items-center">
                                <span className="flex items-center gap-2.5 justify-between w-full">
                                    <span className="flex items-center gap-2.5">
                                        <span className="icon text-2xl line-height-1 flex group-hover:text-primary dark:group-hover:text-white">
                                            <Pencil className="w-4" />
                                        </span>
                                        <span className="font-semibold">Unread</span>
                                    </span>
                                    <span className="font-medium">{unreadCount}</span>
                                </span>
                            </button>
                        </li>
                        <li className={filter === "archived" ? "item-active mb-1.5" : "mb-1.5"}>
                            <button onClick={() => handleFilter("archived")} className="hover:bg-blue-50 dark:hover:bg-slate-700 group hover:text-neutral-900 px-2.5 py-2.5 w-full rounded-lg text-neutral-600 dark:text-white flex items-center">
                                <span className="flex items-center gap-2.5 justify-between w-full">
                                    <span className="flex items-center gap-2.5">
                                        <span className="icon text-2xl line-height-1 flex group-hover:text-primary dark:group-hover:text-white">
                                            <TriangleAlert className="w-4" />
                                        </span>
                                        <span className="font-semibold">Archived</span>
                                    </span>
                                    <span className="font-medium">0</span>
                                </span>
                            </button>
                        </li>
                        <li>
                            <button onClick={() => handleFilter("trash")} className="hover:bg-blue-50 dark:hover:bg-slate-700 group hover:text-neutral-900 px-2.5 py-2.5 w-full rounded-lg text-neutral-600 dark:text-white flex items-center">
                                <span className="flex items-center gap-2.5 justify-between w-full">
                                    <span className="flex items-center gap-2.5">
                                        <span className="icon text-2xl line-height-1 flex group-hover:text-primary dark:group-hover:text-white">
                                            <Trash2 className="w-4" />
                                        </span>
                                        <span className="font-semibold">Trash</span>
                                    </span>
                                    <span className="font-medium">0</span>
                                </span>
                            </button>
                        </li>
                    </ul>
                    <div className="mt-6">
                        <h3 className="text-lg font-semibold text-neutral-600 dark:text-neutral-200 mb-4">TAGS</h3>
                        <ul>
                            <li className="mb-5">
                                <span className="line-height-1 font-medium text-neutral-500 dark:text-neutral-300 text-sm flex items-center gap-2.5">
                                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                    Grants
                                </span>
                            </li>
                            <li className="mb-5">
                                <span className="line-height-1 font-medium text-neutral-500 dark:text-neutral-300 text-sm flex items-center gap-2.5">
                                    <span className="w-2 h-2 bg-purple-600 rounded-full"></span>
                                    Expenses
                                </span>
                            </li>
                            <li className="mb-5">
                                <span className="line-height-1 font-medium text-neutral-500 dark:text-neutral-300 text-sm flex items-center gap-2.5">
                                    <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                                    Compliance
                                </span>
                            </li>
                            <li className="mb-5">
                                <span className="line-height-1 font-medium text-neutral-500 dark:text-neutral-300 text-sm flex items-center gap-2.5">
                                    <span className="w-2 h-2 bg-yellow-600 rounded-full"></span>
                                    Cards
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default EmailSidebar;
