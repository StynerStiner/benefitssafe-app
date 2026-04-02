"use client";

import React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Card, CardContent } from "@/components/ui/card";
import type { CalendarEventData } from "../page";

const CATEGORY_COLORS: Record<string, string> = {
    grants: "#3b82f6",
    payments: "#22c55e",
    compliance: "#eab308",
    subscriptions: "#8b5cf6",
    general: "#6b7280",
};

interface BasicFullCalendarProps {
    events: CalendarEventData[];
    onEventCreate: (eventData: {
        title: string;
        description?: string;
        startDate: string;
        endDate?: string;
        category?: string;
        color?: string;
    }) => void;
    onEventUpdate: (id: string, eventData: {
        title?: string;
        startDate?: string;
    }) => void;
    onEventDelete: (id: string) => void;
}

function BasicFullCalendar({ events, onEventCreate, onEventUpdate, onEventDelete }: BasicFullCalendarProps) {
    const calendarEvents = events.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.startDate,
        end: event.endDate || undefined,
        backgroundColor: event.color || CATEGORY_COLORS[event.category] || CATEGORY_COLORS.general,
        extendedProps: {
            description: event.description,
            category: event.category,
        },
    }));

    // Add event via date click
    const handleDateClick = (info: { dateStr: string }) => {
        const title = prompt("Enter Event Title:");
        if (title) {
            onEventCreate({
                title,
                startDate: info.dateStr,
                category: "general",
            });
        }
    };

    // Edit or delete event via event click
    const handleEventClick = (info: { event: { id: string; title: string } }) => {
        const newTitle = prompt("Edit Event Title (leave blank and confirm to delete):", info.event.title);
        if (newTitle) {
            onEventUpdate(info.event.id, { title: newTitle });
        } else if (newTitle === "") {
            if (confirm("Delete this event?")) {
                onEventDelete(info.event.id);
            }
        }
    };

    return (
        <>
            <Card className="card h-full rounded-lg border-0">
                <CardContent className="card-body p-0 flex flex-col justify-between gap-8">
                    <FullCalendar
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView="dayGridMonth"
                        headerToolbar={{
                            left: "prev,next today",
                            center: "title",
                            right: "dayGridMonth,timeGridWeek,timeGridDay",
                        }}
                        selectable={true}
                        editable={true}
                        events={calendarEvents}
                        dateClick={handleDateClick}
                        eventClick={handleEventClick}
                    />
                </CardContent>
            </Card>
        </>
    );
}
export default BasicFullCalendar;
