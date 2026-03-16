"use client";
import React from "react";
import { Users, UserCheck, Heart, Shield, LineChart, TrendingUp, LucideIcon} from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import CardSmallChart from "@/components/charts/card-small-chart";

interface Beneficiary {
  isActive: boolean;
  benefitPrograms: Record<string, boolean> | null;
  _count?: { grantsAsBeneficiary?: number; expenseRequests?: number };
}

interface StatItem {
  id: string;
  title: string;
  value: string;
  change: string;
  changeColor: "success" | "danger";
  gradientFrom: string;
  bgCircle: string;
  icon: LucideIcon;
  chartId: string;
}

const StatsCard = ({ beneficiaries }: { beneficiaries: Beneficiary[] }) => {
  const total = beneficiaries.length;
  const active = beneficiaries.filter((b) => b.isActive).length;
  const onSSI = beneficiaries.filter((b) => b.benefitPrograms?.ssi).length;
  const onMediCal = beneficiaries.filter((b) => b.benefitPrograms?.mediCal).length;
  const onSSDI = beneficiaries.filter((b) => b.benefitPrograms?.ssdi).length;
  const totalGrants = beneficiaries.reduce((sum, b) => sum + (b._count?.grantsAsBeneficiary || 0), 0);

  const stats: StatItem[] = [
    {
      id: "total-beneficiaries",
      title: "Total Beneficiaries",
      value: total.toLocaleString(),
      change: `${active} active`,
      changeColor: "success",
      gradientFrom: "from-blue-600/10",
      bgCircle: "#487fff",
      icon: Users,
      chartId: "new-user-chart",
    },
    {
      id: "active",
      title: "Active",
      value: active.toLocaleString(),
      change: `${total > 0 ? Math.round((active / total) * 100) : 0}%`,
      changeColor: "success",
      gradientFrom: "from-green-600/10",
      bgCircle: "#45b369",
      icon: UserCheck,
      chartId: "active-user-chart",
    },
    {
      id: "on-ssi",
      title: "On SSI",
      value: onSSI.toLocaleString(),
      change: `${total > 0 ? Math.round((onSSI / total) * 100) : 0}%`,
      changeColor: "success",
      gradientFrom: "from-yellow-500/10",
      bgCircle: "#f4941e",
      icon: Shield,
      chartId: "total-sales-chart",
    },
    {
      id: "on-medical",
      title: "On Medi-Cal",
      value: onMediCal.toLocaleString(),
      change: `${total > 0 ? Math.round((onMediCal / total) * 100) : 0}%`,
      changeColor: "success",
      gradientFrom: "from-purple-600/10",
      bgCircle: "#8252e9",
      icon: Heart,
      chartId: "conversion-user-chart",
    },
    {
      id: "on-ssdi",
      title: "On SSDI",
      value: onSSDI.toLocaleString(),
      change: `${total > 0 ? Math.round((onSSDI / total) * 100) : 0}%`,
      changeColor: "success",
      gradientFrom: "from-pink-600/10",
      bgCircle: "#de3ace",
      icon: LineChart,
      chartId: "leads-chart",
    },
    {
      id: "total-grants",
      title: "Total Grants",
      value: totalGrants.toLocaleString(),
      change: `${totalGrants} assigned`,
      changeColor: "success",
      gradientFrom: "from-cyan-600/10",
      bgCircle: "#00b8f2",
      icon: TrendingUp,
      chartId: "total-profit-chart",
    },
  ];

  return (
    <>
        {
            stats.map((item) => {
                const Icon = item.icon;
                const colorClass =
                item.changeColor === "success"
                    ? "bg-green-100 dark:bg-green-600/25 text-green-600 dark:text-green-400"
                    : "bg-red-100 dark:bg-red-600/25 text-red-600 dark:text-red-400";

                return (
                <Card
                    key={item.id}
                    className={`card !px-4 !py-5 shadow-none rounded-lg !border border-gray-200 dark:border-neutral-600 h-full bg-gradient-to-l ${item.gradientFrom} to-bg-white`}
                >
                    <CardContent className="p-0">
                        <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
                            <div className="flex items-center gap-2">
                                  <span
                                    style={{ backgroundColor: item.bgCircle }}
                                    className={`w-[44px] h-[44px] text-white flex justify-center items-center rounded-full ${item.bgCircle}`}
                                  >
                                    <Icon className="w-6 h-6" />
                                  </span>
                                <div>
                                    <span className="text-sm font-medium text-neutral-600 dark:text-neutral-100">
                                        {item.title}
                                    </span>
                                    <h6 className="font-semibold">{item.value}</h6>
                                </div>
                            </div>
                            <div className="remove-tooltip-title rounded-tooltip-value remove-tooltip-marker">
                                <CardSmallChart chartColor={item.bgCircle} />
                            </div>
                        </div>
                        <p className="text-sm mb-0 text-neutral-600 dark:text-neutral-100">
                            <span className={`px-1 py-px rounded font-medium text-sm ${colorClass}`}>
                                {item.change}
                            </span>
                        </p>
                    </CardContent>
                </Card>
                );
            })
        }
    </>
  );
};

export default StatsCard;
