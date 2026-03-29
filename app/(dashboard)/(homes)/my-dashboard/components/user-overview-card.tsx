"use client";

import UserOverviewChart from '@/components/charts/user-overview-chart';
import CustomSelect from '@/components/shared/custom-select';
import { Card, CardContent } from '@/components/ui/card';
import { useEffect, useState } from 'react';

interface Beneficiary {
  createdAt: string;
}

interface Subscription {
  createdAt: string;
}

const UserOverviewCard = () => {
  const [newBeneficiaries, setNewBeneficiaries] = useState(0);
  const [activeSubscriptions, setActiveSubscriptions] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [benefRes, subRes] = await Promise.all([
          fetch("/api/beneficiaries?limit=100"),
          fetch("/api/subscriptions"),
        ]);

        const benefJson = await benefRes.json();
        const beneficiaries = (Array.isArray(benefJson) ? benefJson : benefJson.data ?? []) as Beneficiary[];
        const subscriptions = (await subRes.json()) as Subscription[];

        // Count new beneficiaries this month
        const now = new Date();
        const newBenefs = beneficiaries.filter((b) => {
          const date = new Date(b.createdAt);
          return (
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear()
          );
        }).length;

        // Count active subscriptions
        const activeSubs = subscriptions.filter((s: unknown) => (s as { status: string }).status === "ACTIVE").length;

        setNewBeneficiaries(newBenefs);
        setActiveSubscriptions(activeSubs);
      } catch (error) {
        console.error("Failed to fetch user overview:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <Card className="card">
        <CardContent className="card-body p-0">
          <p className="text-sm text-neutral-500 text-center py-8">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card">
      <CardContent className="card-body p-0">
        <div className="flex items-center justify-between">
          <h6 className="mb-3 font-semibold text-lg">Users Overview</h6>
          <CustomSelect
            placeholder="Monthly"
            options={["Yearly", "Monthly", "Weekly", "Today"]}
          />
        </div>

        <div className="apexcharts-tooltip-z-none">
          <UserOverviewChart />
        </div>

        <ul className="flex flex-wrap items-center justify-between mt-4 gap-3">
          <li className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-[2px] bg-blue-500"></span>
            <span className="text-neutral-500 dark:text-neutral-300 text-sm font-normal">
              New:
              <span className="text-neutral-500 dark:text-neutral-300 font-semibold">
                {newBeneficiaries}
              </span>
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-[2px] bg-yellow-500"></span>
            <span className="text-neutral-500 dark:text-neutral-300 text-sm font-normal">
              Subscribed:
              <span className="text-neutral-500 dark:text-neutral-300 font-semibold">
                {activeSubscriptions}
              </span>
            </span>
          </li>
        </ul>

      </CardContent>
    </Card>
  );
};

export default UserOverviewCard;