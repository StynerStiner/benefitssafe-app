import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ArrowDownLeft, ArrowUpRight, LucideIcon } from "lucide-react";
import { Badge } from "../ui/badge";

export interface Transaction {
  id: string;
  asset: string;
  time: string;
  date: string;
  amount: string;
  usdValue: string;
  address: string;
  status: "Completed" | "Terminated";
  direction: "in" | "out";
  icon: LucideIcon;
  statusVariant:
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info"
  | "danger";
}

export const transactions: Transaction[] = [
  {
    id: "1",
    asset: "Grant Funding",
    time: "Dec 16",
    date: "2025",
    amount: "+ $25,000",
    usdValue: "",
    address: "Creative Writing",
    status: "Completed",
    statusVariant: "success",
    direction: "in",
    icon: ArrowUpRight,
  },
  {
    id: "2",
    asset: "Adobe CC",
    time: "Dec 18",
    date: "2025",
    amount: "- $659.88",
    usdValue: "",
    address: "Creative Writing",
    status: "Completed",
    statusVariant: "danger",
    direction: "out",
    icon: ArrowDownLeft,
  },
  {
    id: "3",
    asset: "Scrivener",
    time: "Dec 19",
    date: "2025",
    amount: "- $49.00",
    usdValue: "",
    address: "Creative Writing",
    status: "Completed",
    statusVariant: "danger",
    direction: "out",
    icon: ArrowDownLeft,
  },
  {
    id: "4",
    asset: "Grant Funding",
    time: "Jan 15",
    date: "2026",
    amount: "+ $15,000",
    usdValue: "",
    address: "Digital Skills",
    status: "Completed",
    statusVariant: "success",
    direction: "in",
    icon: ArrowUpRight,
  },
  {
    id: "5",
    asset: "Grant Funding",
    time: "Nov 16",
    date: "2025",
    amount: "+ $50,000",
    usdValue: "",
    address: "Housing",
    status: "Completed",
    statusVariant: "success",
    direction: "in",
    icon: ArrowUpRight,
  },
];

const RecentTransactionTable = () => {
  return (
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
        {transactions.map((txn, index) => {
          const isLast = index === transactions.length - 1;
          const Icon = txn.icon;

          const iconColor =
            txn.direction === "in"
              ? "text-green-600 bg-green-100 dark:bg-green-600/25 dark:text-green-400"
              : "text-red-600 bg-red-100 dark:bg-red-600/25 dark:text-red-400";

          return (
            <TableRow key={txn.id}>
              {/* Asset */}
              <TableCell
                className={`py-3 px-4 text-base border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-8 h-8 flex items-center justify-center rounded-full text-xl ${iconColor}`}
                  >
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="font-medium text-neutral-700 dark:text-neutral-200">
                    {txn.asset}
                  </span>
                </div>
              </TableCell>

              {/* Date & Time */}
              <TableCell className="py-3 px-4 text-base border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600">
                <div>
                  <div className="text-neutral-600 dark:text-neutral-200 font-medium">
                    {txn.time}
                  </div>
                  <div className="text-neutral-500 dark:text-neutral-300 text-sm">{txn.date}</div>
                </div>
              </TableCell>

              {/* Amount */}
              <TableCell className="py-3 px-4 text-base border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 text-center">
                <div className="text-neutral-600 dark:text-neutral-200 font-medium">
                  {txn.amount}
                </div>
                <div className="text-neutral-500 dark:text-neutral-300 text-sm">
                  {txn.usdValue}
                </div>
              </TableCell>

              {/* Address */}
              <TableCell className="py-3 px-4 text-base border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 text-center">
                {txn.address}
              </TableCell>

              {/* Status */}
              <TableCell
                className={`py-3 px-4 text-base border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 text-center ${isLast ? "rounded-br-lg" : ""
                  }`}
              >
                <Badge variant={txn.statusVariant}>{txn.status}</Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default RecentTransactionTable;
