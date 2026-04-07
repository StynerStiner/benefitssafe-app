"use client";

import { Skeleton } from "./ui/skeleton";

function StatCardSkeleton() {
  return (
    <div className="card rounded-[16px] p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full bg-neutral-200 dark:bg-slate-600" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-20 bg-neutral-200 dark:bg-slate-600" />
          <Skeleton className="h-6 w-16 bg-neutral-200 dark:bg-slate-600" />
        </div>
      </div>
    </div>
  );
}

function ChartCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={`card rounded-[16px] p-5 ${className ?? ""}`}>
      <Skeleton className="h-5 w-32 mb-4 bg-neutral-200 dark:bg-slate-600" />
      <Skeleton className="h-[200px] w-full rounded-lg bg-neutral-200 dark:bg-slate-600" />
    </div>
  );
}

function TableCardSkeleton() {
  return (
    <div className="card rounded-[16px] p-5">
      <Skeleton className="h-5 w-40 mb-4 bg-neutral-200 dark:bg-slate-600" />
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full bg-neutral-200 dark:bg-slate-600" />
            <Skeleton className="h-4 flex-1 bg-neutral-200 dark:bg-slate-600" />
            <Skeleton className="h-4 w-16 bg-neutral-200 dark:bg-slate-600" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="col-span-12 sm:col-span-6 lg:col-span-3">
            <StatCardSkeleton />
          </div>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-12 gap-6">
        <div className="col-span-12 xl:col-span-8">
          <ChartCardSkeleton />
        </div>
        <div className="col-span-12 xl:col-span-4">
          <TableCardSkeleton />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  );
}

export function BeneficiaryDashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-6">
        {[...Array(5)].map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-12 2xl:col-span-6">
          <ChartCardSkeleton />
        </div>
        <div className="xl:col-span-6 2xl:col-span-3">
          <TableCardSkeleton />
        </div>
        <div className="xl:col-span-6 2xl:col-span-3">
          <TableCardSkeleton />
        </div>
      </div>
    </div>
  );
}

export function VendorDashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="mt-6">
        <TableCardSkeleton />
      </div>
    </div>
  );
}

export function GenericDashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="mt-6">
        <TableCardSkeleton />
      </div>
    </div>
  );
}

export function DashboardSkeleton({ role }: { role?: string }) {
  switch (role) {
    case "nonprofit_admin":
    case "nonprofit_staff":
    case "platform_admin":
      return <AdminDashboardSkeleton />;
    case "beneficiary":
      return <BeneficiaryDashboardSkeleton />;
    case "vendor":
      return <VendorDashboardSkeleton />;
    default:
      return <GenericDashboardSkeleton />;
  }
}
