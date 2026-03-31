"use client";

import CustomSelect from '@/components/shared/custom-select';
import { Card, CardContent } from '@/components/ui/card';
import { UserPlus, UserCheck, Mail, FileUp } from 'lucide-react';
import { useState, useMemo } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filterByPeriod(items: any[], period: string) {
  const now = new Date();
  return items.filter(item => {
    const date = new Date(item.createdAt);
    switch (period) {
      case "Today": return date.toDateString() === now.toDateString();
      case "Weekly": { const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7); return date >= weekAgo; }
      case "Monthly": { const monthAgo = new Date(now); monthAgo.setMonth(now.getMonth() - 1); return date >= monthAgo; }
      case "Yearly": default: { const yearAgo = new Date(now); yearAgo.setFullYear(now.getFullYear() - 1); return date >= yearAgo; }
    }
  });
}

interface Beneficiary {
  createdAt: string;
  enrollmentSource?: string;
}

const CampaignCard = ({ beneficiaries }: { beneficiaries: Beneficiary[] }) => {
  const [selectedPeriod, setSelectedPeriod] = useState("Yearly");

  const filtered = useMemo(() => filterByPeriod(beneficiaries, selectedPeriod), [beneficiaries, selectedPeriod]);

  const stats = useMemo(() => {
    const total = filtered.length || 1;
    const adminAdded = filtered.filter(b => !b.enrollmentSource || b.enrollmentSource === "admin").length;
    const selfEnrolled = filtered.filter(b => b.enrollmentSource === "self").length;
    const invited = filtered.filter(b => b.enrollmentSource === "invite").length;
    const imported = filtered.filter(b => b.enrollmentSource === "import").length;
    return {
      adminAdded: Math.round((adminAdded / total) * 100),
      selfEnrolled: Math.round((selfEnrolled / total) * 100),
      invited: Math.round((invited / total) * 100),
      imported: Math.round((imported / total) * 100),
    };
  }, [filtered]);

  return (
    <Card className="card h-full rounded-lg border-0">
      <CardContent className="card-body p-0">
        <div className="flex items-center flex-wrap gap-2 justify-between">
          <h6 className="mb-0 font-bold text-lg">Enrollment Sources</h6>
          <CustomSelect
            placeholder="Yearly"
            options={["Yearly", "Monthly", "Weekly", "Today"]}
            value={selectedPeriod}
            onValueChange={setSelectedPeriod}
          />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 not-last:mb-5.5">
            <div className="flex items-center">
              <span className="text-2xl line-height-1 flex align-content-center shrink-0 text-orange-500 dark:text-orange-500">
                <UserPlus />
              </span>
              <span className="text-neutral-600 dark:text-neutral-200 font-medium text-sm ps-4">Admin Added</span>
            </div>
            <div className="flex items-center gap-2 w-full">
              <div className="ms-auto">
                <div className="w-[66px] bg-gray-200 rounded-full h-2.5 dark:bg-gray-600">
                  <div className="bg-orange-500 h-2.5 rounded-full" style={{ width: `${stats.adminAdded}%` }}></div>
                </div>
              </div>
              <span className="text-neutral-500 dark:text-neutral-300 font-xs font-semibold">{stats.adminAdded}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 not-last:mb-5.5">
            <div className="flex items-center">
              <span className="text-2xl line-height-1 flex align-content-center shrink-0 text-green-500 dark:text-green-500">
                <UserCheck />
              </span>
              <span className="text-neutral-600 dark:text-neutral-200 font-medium text-sm ps-4">Self-Enrolled</span>
            </div>
            <div className="flex items-center gap-2 w-full">
              <div className="ms-auto">
                <div className="w-[66px] bg-gray-200 rounded-full h-2.5 dark:bg-gray-600">
                  <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${stats.selfEnrolled}%` }}></div>
                </div>
              </div>
              <span className="text-neutral-500 dark:text-neutral-300 font-xs font-semibold">{stats.selfEnrolled}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 not-last:mb-5.5">
            <div className="flex items-center">
              <span className="text-2xl line-height-1 flex align-content-center shrink-0 text-primary dark:text-primary">
                <Mail />
              </span>
              <span className="text-neutral-600 dark:text-neutral-200 font-medium text-sm ps-4">Invited</span>
            </div>
            <div className="flex items-center gap-2 w-full">
              <div className="ms-auto">
                <div className="w-[66px] bg-gray-200 rounded-full h-2.5 dark:bg-gray-600">
                  <div className="bg-primary h-2.5 rounded-full" style={{ width: `${stats.invited}%` }}></div>
                </div>
              </div>
              <span className="text-neutral-500 dark:text-neutral-300 font-xs font-semibold">{stats.invited}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 not-last:mb-5.5">
            <div className="flex items-center">
              <span className="text-2xl line-height-1 flex align-content-center shrink-0 text-purple-600 dark:text-purple-500">
                <FileUp />
              </span>
              <span className="text-neutral-600 dark:text-neutral-200 font-medium text-sm ps-4">Imported</span>
            </div>
            <div className="flex items-center gap-2 w-full">
              <div className="ms-auto">
                <div className="w-[66px] bg-gray-200 rounded-full h-2.5 dark:bg-gray-600">
                  <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${stats.imported}%` }}></div>
                </div>
              </div>
              <span className="text-neutral-500 dark:text-neutral-300 font-xs font-semibold">{stats.imported}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CampaignCard;
