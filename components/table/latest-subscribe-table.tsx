"use client";

import React, { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "../ui/badge";

interface Subscription {
  id: string;
  serviceName: string;
  loginEmail: string;
  status: string;
  createdAt: string;
  monthlyCost: string;
  vendor?: { name: string };
}

const LatestSubscribeTable = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/subscriptions");
        const data = (await res.json()) as Subscription[];
        // Get latest 5, sorted by creation date
        const latest = data
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);
        setSubscriptions(latest);
      } catch (error) {
        console.error("Failed to fetch subscriptions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <Table className="table-auto border-spacing-0 border-separate">
      <TableHeader>
        <TableRow className="border-0">
          <TableHead className="bg-neutral-100 dark:bg-slate-700 border-t border-neutral-200 dark:border-slate-600 overflow-hidden px-4 h-12 border-s rounded-tl-lg">
            Service
          </TableHead>
          <TableHead className="bg-neutral-100 dark:bg-slate-700 border-t border-neutral-200 dark:border-slate-600 overflow-hidden px-4 h-12">
            Created On
          </TableHead>
          <TableHead className="bg-neutral-100 dark:bg-slate-700 border-t border-neutral-200 dark:border-slate-600 overflow-hidden px-4 h-12">
            Cost
          </TableHead>
          <TableHead className="bg-neutral-100 dark:bg-slate-700 border-t border-neutral-200 dark:border-slate-600 overflow-hidden px-4 h-12 border-e rounded-tr-lg text-center">
            Status
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {loading ? (
          <TableRow>
            <TableCell colSpan={4} className="py-8 px-4 text-center">
              <span className="text-sm text-neutral-500">Loading subscriptions...</span>
            </TableCell>
          </TableRow>
        ) : subscriptions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="py-8 px-4 text-center">
              <span className="text-sm text-neutral-500">No subscriptions yet</span>
            </TableCell>
          </TableRow>
        ) : (
          subscriptions.map((subscription, index) => {
            const isLastRow = index === subscriptions.length - 1;
            const createdDate = new Date(subscription.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            const statusVariant =
              subscription.status === "ACTIVE"
                ? "default"
                : subscription.status === "PAUSED"
                ? "warning"
                : "secondary";

            return (
              <TableRow key={subscription.id}>
                <TableCell
                  className={`py-3 px-4 border-b border-neutral-200 dark:border-slate-600 first:border-s last:border-e ${
                    isLastRow ? "rounded-bl-lg" : ""
                  }`}
                >
                  <div>
                    <h6 className="text-base mb-0 font-medium">{subscription.serviceName}</h6>
                    <span className="text-sm text-neutral-600 dark:text-neutral-300">
                      {subscription.loginEmail}
                    </span>
                  </div>
                </TableCell>
                <TableCell
                  className={`py-3 px-4 border-b border-neutral-200 dark:border-slate-600 first:border-s last:border-e ${
                    isLastRow ? "rounded-bl-lg" : ""
                  }`}
                >
                  {createdDate}
                </TableCell>
                <TableCell
                  className={`py-3 px-4 border-b border-neutral-200 dark:border-slate-600 first:border-s last:border-e ${
                    isLastRow ? "rounded-bl-lg" : ""
                  }`}
                >
                  <span className="font-medium">
                    ${parseFloat(subscription.monthlyCost || "0").toFixed(2)}/mo
                  </span>
                </TableCell>
                <TableCell
                  className={`py-3 px-4 border-b border-neutral-200 dark:border-slate-600 first:border-s last:border-e ${
                    isLastRow ? "rounded-br-lg" : ""
                  } text-center`}
                >
                  <Badge variant={statusVariant as any} className="rounded-[50rem]">
                    {subscription.status}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
};

export default LatestSubscribeTable;
