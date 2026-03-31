"use client";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import { Suspense, useCallback, useEffect, useState } from "react";
import AverageEarningCard from "./components/average-earning-card";
import MyTasksCard from "./components/my-tasks-card";
import ProjectAnalysisCard from "./components/project-analysis-card";
import ProjectWidgets from "./components/project-widgets";
import ProjectsStatusCard from "./components/projects-status-card";
import TasksOverviewCard from "./components/tasks-overview-card";
import TeamMembersCard from "./components/team-members-card";
import WorkingScheduleCard from "./components/working-schedule-card";
import AddGrantForm from "./components/add-grant-form";

interface Grant {
    id: string;
    name: string;
    description: string | null;
    status: string;
    totalAmount: string;
    spentAmount: string;
    remainingAmount: string;
    startDate: string;
    endDate: string | null;
    grantIssuerName: string;
    grantIssuerContact: string | null;
    beneficiaryId: string | null;
    beneficiary: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    } | null;
    categories: {
        id: string;
        name: string;
        allocatedAmount: string;
        spentAmount: string;
    }[];
    createdAt: string;
}

const ProjectManagement = () => {
    const [grants, setGrants] = useState<Grant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchGrants = useCallback(() => {
        fetch("/api/grants?limit=100")
            .then((res) => {
                if (!res.ok) return { data: [] };
                return res.json();
            })
            .then((json) => {
                const items = Array.isArray(json) ? json : json.data;
                if (Array.isArray(items)) setGrants(items);
            })
            .catch(() => {
                setError("Failed to load grants. Please try refreshing the page.");
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetchGrants();
    }, [fetchGrants]);

    if (loading) {
        return (
            <>
                <DashboardBreadcrumb title="Grants" text="Grant Management" />
                <LoadingSkeleton />
            </>
        );
    }

    return (
        <>
            <div className="flex items-center justify-between">
                <DashboardBreadcrumb title="Grants" text="Grant Management" />
                <AddGrantForm />
            </div>

            {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">

                <div className="col-span-12 2xl:col-span-8">
                    <AverageEarningCard grants={grants} />
                </div>

                <div className="col-span-12 2xl:col-span-4">
                    <WorkingScheduleCard grants={grants} />
                </div>

                <div className="col-span-12 sm:col-span-12">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
                        <ProjectWidgets grants={grants} />
                    </div>
                </div>

                <div className="col-span-12 sm:col-span-6 2xl:col-span-4">
                    <MyTasksCard grants={grants} />
                </div>

                <div className="col-span-12 sm:col-span-6 2xl:col-span-4">
                    <ProjectAnalysisCard grants={grants} />
                </div>

                <div className="col-span-12 sm:col-span-6 2xl:col-span-4">
                    <TeamMembersCard grants={grants} />
                </div>

                <div className="col-span-12 sm:col-span-6 2xl:col-span-4">
                    <TasksOverviewCard grants={grants} />
                </div>

                <div className="col-span-12 2xl:col-span-8">
                    <ProjectsStatusCard grants={grants} onRefresh={fetchGrants} />
                </div>
            </div>
        </>
    );
};
export default ProjectManagement;
