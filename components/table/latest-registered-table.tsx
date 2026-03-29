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

interface Beneficiary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
  isActive: boolean;
}

const LatestRegisteredTable = () => {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/beneficiaries?limit=5");
        const json = await res.json();
        const data = (Array.isArray(json) ? json : json.data ?? []) as Beneficiary[];
        // Get latest 5, sorted by creation date
        const latest = data.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ).slice(0, 5);
        setBeneficiaries(latest);
      } catch (error) {
        console.error("Failed to fetch beneficiaries:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const slicedUsers = beneficiaries;

  return (
    <Table className="table-auto border-spacing-0 border-separate">
      <TableHeader>
        <TableRow className="border-0">
          <TableHead className="bg-neutral-100 dark:bg-slate-700 border-t border-neutral-200 dark:border-slate-600 overflow-hidden px-4 h-12 border-s rounded-tl-lg">
            Users
          </TableHead>
          <TableHead className="bg-neutral-100 dark:bg-slate-700 border-t border-neutral-200 dark:border-slate-600 overflow-hidden px-4 h-12">
            Registered On
          </TableHead>
          <TableHead className="bg-neutral-100 dark:bg-slate-700 border-t border-neutral-200 dark:border-slate-600 overflow-hidden px-4 h-12">
            Plan
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
              <span className="text-sm text-neutral-500">Loading beneficiaries...</span>
            </TableCell>
          </TableRow>
        ) : slicedUsers.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="py-8 px-4 text-center">
              <span className="text-sm text-neutral-500">No beneficiaries yet</span>
            </TableCell>
          </TableRow>
        ) : (
          slicedUsers.map((beneficiary, index) => {
            const isLastRow = index === slicedUsers.length - 1;
            const initials = `${beneficiary.firstName?.[0] || ""}${beneficiary.lastName?.[0] || ""}`.toUpperCase();
            const registeredDate = new Date(beneficiary.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <TableRow key={beneficiary.id}>
                <TableCell
                  className={`py-3 px-4 border-b border-neutral-200 dark:border-slate-600 first:border-s last:border-e ${
                    isLastRow ? "rounded-bl-lg" : ""
                  }`}
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full shrink-0 me-2 overflow-hidden bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                      {initials}
                    </div>
                    <div>
                      <h6 className="text-base mb-0 font-medium">
                        {beneficiary.firstName} {beneficiary.lastName}
                      </h6>
                      <span className="text-sm text-neutral-600 dark:text-neutral-300">
                        {beneficiary.email}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell
                  className={`py-3 px-4 border-b border-neutral-200 dark:border-slate-600 first:border-s last:border-e ${
                    isLastRow ? "rounded-bl-lg" : ""
                  }`}
                >
                  {registeredDate}
                </TableCell>
                <TableCell
                  className={`py-3 px-4 border-b border-neutral-200 dark:border-slate-600 first:border-s last:border-e ${
                    isLastRow ? "rounded-bl-lg" : ""
                  }`}
                >
                  <span className="text-sm">Beneficiary</span>
                </TableCell>
                <TableCell
                  className={`py-3 px-4 border-b border-neutral-200 dark:border-slate-600 first:border-s last:border-e ${
                    isLastRow ? "rounded-br-lg" : ""
                  } text-center`}
                >
                  <Badge
                    variant={beneficiary.isActive ? "default" : "secondary"}
                    className="rounded-[50rem]"
                  >
                    {beneficiary.isActive ? "Active" : "Inactive"}
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

export default LatestRegisteredTable;
