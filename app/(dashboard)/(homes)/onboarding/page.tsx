import CourseActivityCard from "@/app/(dashboard)/(homes)/onboarding/components/course-activity-card";
import CoursesCard from "@/app/(dashboard)/(homes)/onboarding/components/courses-card";
import StudentProgressCard from "@/app/(dashboard)/(homes)/onboarding/components/student-progress-card";
import TopCategoriesCard from "@/app/(dashboard)/(homes)/onboarding/components/top-categories-card";
import TopInstructorsCard from "@/app/(dashboard)/(homes)/onboarding/components/top-instructors-card";
import TrafficSourceCard from "@/app/(dashboard)/(homes)/onboarding/components/traffic-source-card";
import WidgetsAverageChart from "@/app/(dashboard)/(homes)/onboarding/components/widgets-average-chart";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import type { Metadata } from "next";
import { Suspense } from "react";

const metadata: Metadata = {
    title: "LMS Dashboard | BenefitsSafe Admin Panel",
    description:
        "Manage courses, track student progress, and analyze learning outcomes with the LMS Dashboard in BenefitsSafe Admin Template built using Next.js and Tailwind.",
};

const LmsPage = () => {
    return (
        <>
            <DashboardBreadcrumb title="LMS / Learning System" text="LMS / Learning System" />

            <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6">
                <div className="col-span-12 2xl:col-span-8">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <WidgetsAverageChart />
                    </Suspense>
                </div>
                <div className="col-span-12 md:col-span-6 2xl:col-span-4">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <TrafficSourceCard />
                    </Suspense>
                </div>
                <div className="col-span-12 md:col-span-6 2xl:col-span-4">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <TopCategoriesCard />
                    </Suspense>
                </div>
                <div className="col-span-12 md:col-span-6 2xl:col-span-4">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <TopInstructorsCard />
                    </Suspense>
                </div>
                <div className="col-span-12 md:col-span-6 2xl:col-span-4">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <StudentProgressCard />
                    </Suspense>
                </div>
                <div className="col-span-12 2xl:col-span-8">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <CoursesCard />
                    </Suspense>
                </div>
                <div className="col-span-12 2xl:col-span-4">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <CourseActivityCard />
                    </Suspense>
                </div>
            </div>
        </>
    );
};
export default LmsPage;
