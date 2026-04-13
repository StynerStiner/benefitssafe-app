"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import React from "react";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EllipsisVertical, Trash } from "lucide-react";
import AddEvent from "./add-event";
import EditEvent from "./edit-event";
import ViewEvent from "./view-event";
import type { CalendarEventData } from "../page";

const CATEGORY_COLORS: Record<string, string> = {
    grants: "bg-blue-500",
    payments: "bg-green-600",
    compliance: "bg-yellow-500",
    subscriptions: "bg-violet-600",
    general: "bg-cyan-600",
};

const CATEGORY_LABELS: Record<string, string> = {
    grants: "Grants",
    payments: "Payments",
    compliance: "Compliance",
    subscriptions: "Subscriptions",
    general: "General",
};

export interface SidebarEvent {
    id: string;
    title: string;
    label: string;
    color: string;
    startTime: string;
    endTime: string;
    description: string;
    category: string;
    synthetic: boolean;
}

function toSidebarEvent(event: CalendarEventData): SidebarEvent {
    const start = new Date(event.startDate);
    const end = event.endDate ? new Date(event.endDate) : null;

    return {
        id: event.id,
        title: event.title,
        label: CATEGORY_LABELS[event.category] || "General",
        color: CATEGORY_COLORS[event.category] || "bg-cyan-600",
        startTime: start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
            ", " + start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        endTime: end
            ? end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
            : "",
        description: event.description || "",
        category: event.category,
        synthetic: event.synthetic ?? false,
    };
}

interface CalendarSidebarProps {
    events: CalendarEventData[];
    onAddEvent: (eventData: {
        title: string;
        description?: string;
        startDate: string;
        endDate?: string;
        category?: string;
        color?: string;
    }) => void;
    onEditEvent: (id: string, eventData: {
        title?: string;
        description?: string;
        startDate?: string;
        endDate?: string;
        category?: string;
    }) => void;
    onDeleteEvent: (id: string) => void;
}

const CalendarSidebar: React.FC<CalendarSidebarProps> = ({ events, onAddEvent, onEditEvent, onDeleteEvent }) => {
    const sidebarEvents = events.map(toSidebarEvent);

    const handleAddEvent = (newEvent: { title: string; label: string; description: string; startTime: string; endTime: string; category?: string }) => {
        const categoryMap: Record<string, string> = {
            "Grants": "grants",
            "Payments": "payments",
            "Compliance": "compliance",
            "Subscriptions": "subscriptions",
            "General": "general",
        };

        onAddEvent({
            title: newEvent.title,
            description: newEvent.description || undefined,
            startDate: new Date(newEvent.startTime).toISOString(),
            endDate: newEvent.endTime ? new Date(newEvent.endTime).toISOString() : undefined,
            category: categoryMap[newEvent.label] || newEvent.category || "general",
        });
    };

    const handleUpdateEvent = (updatedEvent: { id: string; title: string; label: string; description: string; startTime: string; endTime: string }) => {
        const categoryMap: Record<string, string> = {
            "Grants": "grants",
            "Payments": "payments",
            "Compliance": "compliance",
            "Subscriptions": "subscriptions",
            "General": "general",
        };

        onEditEvent(updatedEvent.id, {
            title: updatedEvent.title,
            description: updatedEvent.description || undefined,
            startDate: new Date(updatedEvent.startTime).toISOString(),
            endDate: updatedEvent.endTime ? new Date(updatedEvent.endTime).toISOString() : undefined,
            category: categoryMap[updatedEvent.label] || "general",
        });
    };

    const handleRemoveEvent = (id: string) => {
        onDeleteEvent(id);
    };

    return (
        <Card className="h-full border-0 !p-0 rounded-lg">
            <CardContent className="p-0">
                <div className="p-6">
                    <AddEvent onAddEvent={handleAddEvent} />
                </div>

                <div className="space-y-4 max-h-[700px] overflow-y-auto p-6 pt-0">
                    {sidebarEvents.length > 0 ? (
                        sidebarEvents.map((event) => (
                            <div
                                key={event.id}
                                className="flex items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-600"
                            >
                                <div>
                                    <div className="flex items-center gap-2.5">
                                        <span className={cn("w-3 h-3 rounded-full", event.color)} />
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-800 dark:text-gray-200">
                                                {event.startTime}
                                            </span>
                                            {event.endTime && (
                                                <>
                                                    <span>-</span>
                                                    <span className="text-gray-800 dark:text-gray-200">
                                                        {event.endTime}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-neutral-600 dark:text-neutral-200 font-semibold text-base mt-1.5">
                                        {event.title}
                                    </span>
                                </div>

                                <DropdownMenu>
                                    <DropdownMenuTrigger className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                                        <EllipsisVertical width={18} />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem asChild>
                                            <ViewEvent addOnViewEvent={event} />
                                        </DropdownMenuItem>

                                        {!event.synthetic && (
                                            <>
                                                <DropdownMenuItem asChild>
                                                    <EditEvent onEditEvent={handleUpdateEvent} event={event} />
                                                </DropdownMenuItem>

                                                <DropdownMenuItem
                                                    onClick={() => handleRemoveEvent(event.id)}
                                                >
                                                    <Trash /> Delete
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                        {event.synthetic && (
                                            <DropdownMenuItem disabled className="text-xs text-neutral-400">
                                                Auto-generated from grant
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        ))
                    ) : (
                        <div className="text-center">
                            <span className="text-xl text-neutral-800 ">No events found</span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default CalendarSidebar;
