import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import React from "react";

interface LedgerEntryData {
  id: string;
  grantId: string;
  type: string;
  amount: string;
  balanceAfter: string;
  description: string;
  reference: string | null;
  createdAt: string;
}

interface GrantData {
  id: string;
  name: string;
  totalAmount: string;
  spentAmount: string;
  remainingAmount: string;
}

const RecentTransactionCard = ({
  ledgerEntries,
  grants,
}: {
  ledgerEntries: LedgerEntryData[];
  grants: GrantData[];
}) => {
  const grantMap = new Map(grants.map((g) => [g.id, g.name]));

  return (
    <Card className="card h-full border-0">
      <CardContent className="card-body p-0">
        <div className="flex items-center flex-wrap gap-2 justify-between mb-5">
          <h6 className="mb-0 font-bold text-lg">Recent Activity</h6>
          <CommonLink />
        </div>

        <Table className="table-auto border-spacing-0 border-separate">
          <TableHeader>
            <TableRow className="border-0">
              <TableHead className="px-4 h-12 bg-neutral-100 dark:bg-slate-700 border-t border-neutral-200 first:border-s last:border-e dark:border-slate-600 rounded-tl-lg">
                Entry
              </TableHead>
              <TableHead className="px-4 h-12 bg-neutral-100 dark:bg-slate-700 border-t border-neutral-200 first:border-s last:border-e dark:border-slate-600">
                Date
              </TableHead>
              <TableHead className="px-4 h-12 text-center bg-neutral-100 dark:bg-slate-700 border-t border-neutral-200 first:border-s last:border-e dark:border-slate-600">
                Amount
              </TableHead>
              <TableHead className="px-4 h-12 text-center bg-neutral-100 dark:bg-slate-700 border-t border-neutral-200 first:border-s last:border-e dark:border-slate-600">
                Grant
              </TableHead>
              <TableHead className="px-4 h-12 text-center bg-neutral-100 dark:bg-slate-700 border-t border-neutral-200 first:border-s last:border-e dark:border-slate-600 rounded-tr-lg">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {ledgerEntries.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-3 px-4 text-base border border-neutral-200 dark:border-slate-600 rounded-bl-lg rounded-br-lg text-center"
                >
                  No ledger entries
                </TableCell>
              </TableRow>
            ) : (
              ledgerEntries.map((entry, index) => {
                const isLast = index === ledgerEntries.length - 1;
                const isCredit = entry.type === "CREDIT";
                const Icon = isCredit ? ArrowUpRight : ArrowDownLeft;
                const iconColor = isCredit
                  ? "text-green-600 bg-green-100 dark:bg-green-600/25 dark:text-green-400"
                  : "text-red-600 bg-red-100 dark:bg-red-600/25 dark:text-red-400";
                const amt = parseFloat(entry.amount);
                const formattedAmount = `${isCredit ? "+ " : "- "}${amt.toLocaleString("en-US", { style: "currency", currency: "USD" })}`;
                const dateObj = new Date(entry.createdAt);
                const dateStr = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                const yearStr = dateObj.getFullYear().toString();
                const grantName = grantMap.get(entry.grantId) ?? "Unknown";

                return (
                  <TableRow key={entry.id}>
                    <TableCell
                      className={`py-3 px-4 text-base border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-8 h-8 flex items-center justify-center rounded-full text-xl ${iconColor}`}
                        >
                          <Icon className="w-5 h-5" />
                        </span>
                        <span className="font-medium text-neutral-700 dark:text-neutral-200">
                          {entry.description}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="py-3 px-4 text-base border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600">
                      <div>
                        <div className="text-neutral-600 dark:text-neutral-200 font-medium">
                          {dateStr}
                        </div>
                        <div className="text-neutral-500 dark:text-neutral-300 text-sm">{yearStr}</div>
                      </div>
                    </TableCell>

                    <TableCell className="py-3 px-4 text-base border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 text-center">
                      <div className="text-neutral-600 dark:text-neutral-200 font-medium">
                        {formattedAmount}
                      </div>
                      <div className="text-neutral-500 dark:text-neutral-300 text-sm"></div>
                    </TableCell>

                    <TableCell className="py-3 px-4 text-base border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 text-center">
                      {grantName}
                    </TableCell>

                    <TableCell
                      className={`py-3 px-4 text-base border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 text-center ${isLast ? "rounded-br-lg" : ""}`}
                    >
                      <Badge variant={isCredit ? "success" : "danger"}>Completed</Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default RecentTransactionCard;
