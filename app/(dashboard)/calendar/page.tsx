import type { Metadata } from "next";
import React from "react";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { Suspense } from "react";
import LoadingSkeleton from "@/components/loading-skeleton";
import BasicFullCalendar from "./components/basic-full-calendar";
import CalendarSidebar from "./components/calendar-sidebar";

const metadata: Metadata = {
    title: "Calendar & Event Scheduling | BenefitsSafe Admin Dashboard",
    description:
        "Plan, organize, and track events effortlessly with the interactive calendar in the BenefitsSafe Admin Dashboard, built using Next.js, Tailwind CSS, and shadcn UI.",
};


const CalendarPage = () => {
    return (
        <>
            <DashboardBreadcrumb title="Calendar" text="Calendar" />

            <Suspense fallback={<LoadingSkeleton />}>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    <div className="col-span-12 lg:col-span-4 2xl:col-span-3">
                        <CalendarSidebar />
                    </div>

                    <div className="col-span-12 lg:col-span-8 2xl:col-span-9">
                        <BasicFullCalendar />
                    </div>

                </div>
            </Suspense>

        </>
    );
};
export default CalendarPage;