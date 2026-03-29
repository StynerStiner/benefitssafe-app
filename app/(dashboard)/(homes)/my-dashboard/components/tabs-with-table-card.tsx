"use client";

import LatestRegisteredTable from '@/components/table/latest-registered-table';
import LatestSubscribeTable from '@/components/table/latest-subscribe-table';
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from 'react';

interface Beneficiary {
  id: string;
}

interface Subscription {
  id: string;
}

const TabsWithTableCard = () => {
  const [beneficiaryCount, setBeneficiaryCount] = useState(0);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [benefRes, subRes] = await Promise.all([
          fetch("/api/beneficiaries?limit=1"),
          fetch("/api/subscriptions"),
        ]);

        const benefJson = await benefRes.json();
        const subscriptions = (await subRes.json()) as Subscription[];

        // Use total from paginated response when available
        const benefTotal = Array.isArray(benefJson) ? benefJson.length : (benefJson.total ?? 0);
        setBeneficiaryCount(benefTotal);
        setSubscriptionCount(subscriptions.length);
      } catch (error) {
        console.error("Failed to fetch counts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <Card className="card">
      <CardContent className="px-0">
        <Tabs defaultValue="latestRegistered" className="gap-4">
          <TabsList className='active-gradient bg-transparent dark:bg-transparent rounded-none h-[50px]'>
            <TabsTrigger value="latestRegistered" className='py-2.5 px-4 font-semibold text-lg inline-flex items-center gap-3 dark:bg-transparent text-neutral-600 hover:text-primary dark:text-white dark:hover:text-blue-500 data-[state=active]:bg-gradient border-0 border-t-2 border-neutral-200 dark:border-neutral-500 data-[state=active]:border-primary dark:data-[state=active]:border-primary rounded-[0] data-[state=active]:shadow-none cursor-pointer'>
              Latest Beneficiaries
              <span className="text-white px-2 py-0.5 bg-neutral-600 rounded-full text-sm">
                {loading ? "..." : beneficiaryCount}
              </span>
            </TabsTrigger>
            <TabsTrigger value="latestSubscribe" className='py-2.5 px-4 font-semibold text-lg inline-flex items-center gap-3 dark:bg-transparent text-neutral-600 hover:text-primary dark:text-white dark:hover:text-blue-500 data-[state=active]:bg-gradient border-0 border-t-2 border-neutral-200 dark:border-neutral-500 data-[state=active]:border-primary dark:data-[state=active]:border-primary rounded-[0] data-[state=active]:shadow-none cursor-pointer'>
              Latest Subscriptions
              <span className="text-white px-2 py-0.5 bg-neutral-600 rounded-full text-sm">
                {loading ? "..." : subscriptionCount}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="latestRegistered">
            <LatestRegisteredTable />
          </TabsContent>
          <TabsContent value="latestSubscribe">
            <LatestSubscribeTable />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TabsWithTableCard;