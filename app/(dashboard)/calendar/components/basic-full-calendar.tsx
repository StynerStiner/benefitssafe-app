"use client";

import React, { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Card, CardContent } from "@/components/ui/card";
import { v4 as uuidv4 } from "uuid";

function BasicFullCalendar() {
    const [events, setEvents] = useState([
        {
            id: uuidv4(),
            title: "Grant Review — Creative Writing Fellowship",
            start: "2026-03-18T10:00:00"
        },
        {
            id: uuidv4(),
            title: "Compliance Check — Housing Stability",
            start: "2026-03-20T14:00:00"
        },
        {
            id: uuidv4(),
            title: "Budget Review — Digital Skills Training",
            start: "2026-03-22T09:00:00"
        },
        {
            id: uuidv4(),
            title: "Vendor Payment Due — Adobe CC",
            start: "2026-03-25"
        },
        {
            id: uuidv4(),
            title: "Subscription Renewal — Scrivener",
            start: "2026-03-28"
        },
    ]);

    // Add event
    const handleDateClick = (info: any) => {
        const title = prompt("Enter Event Title:");
        if (title) {
            setEvents([
                ...events,
                {
                    id: uuidv4(),
                    title,
                    start: info.date
                }
            ]);
        }
    };

    // Edit event
    const handleEventClick = (info: any) => {
        const newTitle = prompt("Edit Event Title:", info.event.title);
        if (newTitle) {
            setEvents(
                events.map((event) =>
                    event.id === info.event.id ? { ...event, title: newTitle } : event
                )
            );
        } else if (newTitle === "") {
            // Delete if blank
            if (confirm("Delete this event?")) {
                setEvents(events.filter((event) => event.id !== info.event.id));
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
                        events={events}
                        dateClick={handleDateClick}
                        eventClick={handleEventClick}
                    />
                </CardContent>
            </Card>
        </>
    );
}
export default BasicFullCalendar;