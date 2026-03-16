import type { Metadata } from 'next';
import DashboardBreadcrumb from '@/components/layout/dashboard-breadcrumb';
import ClientFirebaseWrapper from './client-wrapper';

export const metadata: Metadata = {
    title: 'Notification Settings & Preferences | BenefitsSafe Admin Dashboard',
    description:
        'Configure and customize notification settings and preferences in the BenefitsSafe Admin Dashboard built with Next.js and Tailwind CSS.',
};

export default function NotificationPage() {
    return (
        <>
            <DashboardBreadcrumb title="Notification" text="Notification" />
            <div className="rounded-xl border border-border bg-white dark:bg-[#273142] p-6 shadow-sm">
                <ClientFirebaseWrapper />
            </div>
        </>
    );
}
