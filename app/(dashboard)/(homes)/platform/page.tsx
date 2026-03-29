"use client";

import { useState, useEffect } from "react";
import StatCards from "@/app/(dashboard)/(homes)/platform/components/stat-cards";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import { Suspense } from "react";
import AvailableTreatmentsCard from "./components/available-treatments-card";
import DoctorListCard from "./components/doctor-list-card";
import EarningStatisticCard from "./components/earning-statistic-card";
import HealthReportsDocumentCard from "./components/health-reports-document-card";
import LatestAppointmentsCard from "./components/latest-appointments-card";
import PatientVisitedDepartment from "./components/patient-visited-department";
import PatientVisitedGender from "./components/patient-visited-gender";
import TotalIncomeCard from "./components/total-income-card";

interface RecentOrg {
    id: string;
    name: string;
    createdAt: string;
    _count: { users: number };
}

interface RecentUser {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    createdAt: string;
}

interface PlatformStats {
    totalOrgs: number;
    totalUsers: number;
    totalGrants: number;
    activeGrants: number;
    recentOrgs: RecentOrg[];
    recentUsers: RecentUser[];
}

const MedicalPage = () => {
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/platform/stats")
            .then((res) => res.json())
            .then((json) => {
                if (json.data) setStats(json.data);
            })
            .catch(() => {
                // Silently fail - stats are optional for display
                setStats(null);
            })
            .finally(() => setLoading(false));
    }, []);

    return (
        <>
            <DashboardBreadcrumb title="Platform Admin" text="Platform Admin" />

            <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6">

                <div className="col-span-12 2xl:col-span-9">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
                        <div className="col-span-12 2xl:col-span-12">
                            <Suspense fallback={<LoadingSkeleton />}>
                                <StatCards
                                    totalOrgs={stats?.totalOrgs ?? 0}
                                    totalUsers={stats?.totalUsers ?? 0}
                                    totalGrants={stats?.totalGrants ?? 0}
                                    activeGrants={stats?.activeGrants ?? 0}
                                    loading={loading}
                                />
                            </Suspense>
                        </div>
                        <div className="col-span-12 2xl:col-span-12">
                            <Suspense fallback={<LoadingSkeleton />}>
                                <EarningStatisticCard />
                            </Suspense>
                        </div>
                        <div className="col-span-12 lg:col-span-6">
                            <Suspense fallback={<LoadingSkeleton />}>
                                <PatientVisitedDepartment />
                            </Suspense>
                        </div>
                        <div className="col-span-12 lg:col-span-6">
                            <Suspense fallback={<LoadingSkeleton />}>
                                <PatientVisitedGender />
                            </Suspense>
                        </div>
                        <div className="col-span-12 2xl:col-span-4">
                            <Suspense fallback={<LoadingSkeleton />}>
                                <DoctorListCard
                                    recentOrgs={stats?.recentOrgs ?? []}
                                    loading={loading}
                                />
                            </Suspense>
                        </div>
                        <div className="col-span-12 2xl:col-span-8">
                            <Suspense fallback={<LoadingSkeleton />}>
                                <LatestAppointmentsCard
                                    recentUsers={stats?.recentUsers ?? []}
                                    loading={loading}
                                />
                            </Suspense>
                        </div>
                    </div>
                </div>

                <div className="col-span-12 2xl:col-span-3">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        <div className="col-span-12 2xl:col-span-6 md:col-span-6 2xl:col-span-12">
                            <Suspense fallback={<LoadingSkeleton />}>
                                <TotalIncomeCard />
                            </Suspense>
                        </div>
                        <div className="col-span-12 2xl:col-span-6 md:col-span-6 2xl:col-span-12">
                            <Suspense fallback={<LoadingSkeleton />}>
                                <AvailableTreatmentsCard />
                            </Suspense>
                        </div>
                        <div className="col-span-12 2xl:col-span-6 md:col-span-6 2xl:col-span-12">
                            <Suspense fallback={<LoadingSkeleton />}>
                                <HealthReportsDocumentCard />
                            </Suspense>
                        </div>
                    </div>
                </div>

            </div>
        </>
    );
};
export default MedicalPage;
