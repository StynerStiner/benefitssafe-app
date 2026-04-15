"use client";

import React, { useState, useEffect, useCallback } from "react";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import BasicFullCalendar from "./components/basic-full-calendar";
import CalendarSidebar from "./components/calendar-sidebar";
import { CalendarDays } from "lucide-react";
import toast from "react-hot-toast";

export interface CalendarEventData {
    id: string;
    title: string;
    description: string | null;
    startDate: string;
    endDate: string | null;
    category: string;
    color: string | null;
    createdById: string;
    organizationId: string;
    createdAt: string;
    updatedAt: string;
    // true when the row is synthesized from grant data (GET /api/events merges
    // grant-lifecycle entries). Synthetic rows are not editable or deletable;
    // the source of truth is the Grant itself.
    synthetic?: boolean;
}

const CalendarPage = () => {
    const [events, setEvents] = useState<CalendarEventData[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchEvents = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/events");
            if (!res.ok) throw new Error("Failed to fetch events");
            const data = await res.json();
            setEvents(data.events || []);
        } catch (error) {
            console.error("Error fetching events:", error);
            toast.error("Failed to load events");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    const handleCreateEvent = async (eventData: {
        title: string;
        description?: string;
        startDate: string;
        endDate?: string;
        category?: string;
        color?: string;
    }) => {
        try {
            const res = await fetch("/api/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(eventData),
            });
            if (!res.ok) throw new Error("Failed to create event");
            toast.success("Event created successfully");
            await fetchEvents();
        } catch (error) {
            console.error("Error creating event:", error);
            toast.error("Failed to create event");
        }
    };

    const handleUpdateEvent = async (id: string, eventData: {
        title?: string;
        description?: string;
        startDate?: string;
        endDate?: string;
        category?: string;
        color?: string;
    }) => {
        try {
            const res = await fetch(`/api/events/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(eventData),
            });
            if (!res.ok) throw new Error("Failed to update event");
            toast.success("Event updated successfully");
            await fetchEvents();
        } catch (error) {
            console.error("Error updating event:", error);
            toast.error("Failed to update event");
        }
    };

    const handleDeleteEvent = async (id: string) => {
        try {
            const res = await fetch(`/api/events/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to delete event");
            toast.success("Event deleted successfully");
            await fetchEvents();
        } catch (error) {
            console.error("Error deleting event:", error);
            toast.error("Failed to delete event");
        }
    };

    if (loading) {
        return (
            <>
                <DashboardBreadcrumb title="Calendar" text="Calendar" />
                <LoadingSkeleton />
            </>
        );
    }

    return (
        <>
            <DashboardBreadcrumb title="Calendar" text="Calendar" />

            {events.length === 0 && (
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <CalendarDays className="w-5 h-5 text-primary" aria-hidden="true" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                            No events yet
                        </p>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            Grant start and end dates will appear here automatically. Click any day on the calendar below to create your first event manually.
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                <div className="col-span-12 lg:col-span-4 2xl:col-span-3">
                    <CalendarSidebar
                        events={events}
                        onAddEvent={handleCreateEvent}
                        onEditEvent={handleUpdateEvent}
                        onDeleteEvent={handleDeleteEvent}
                    />
                </div>

                <div className="col-span-12 lg:col-span-8 2xl:col-span-9">
                    <BasicFullCalendar
                        events={events}
                        onEventCreate={handleCreateEvent}
                        onEventUpdate={handleUpdateEvent}
                        onEventDelete={handleDeleteEvent}
                    />
                </div>

            </div>

        </>
    );
};
export default CalendarPage;
