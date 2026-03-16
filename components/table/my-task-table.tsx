"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Badge } from "../ui/badge";

interface AssetOrder {
  name: string;
  date: string;
  status: "Pending" | "Completed" | "In Progress" | "Cancelled";
  statusVariant:
  | "default"
  | "warning"
  | "success"
  | "info"
  | "danger"
};

const orders: AssetOrder[] = [
  {
    name: "Web Development",
    date: "10 Jan 2025",
    status: "Pending",
    statusVariant: "warning"
  },
  {
    name: "UX/UI Design",
    date: "10 Jan 2025",
    status: "Completed",
    statusVariant: "success",
  },
  {
    name: "React Development",
    date: "10 Jan 2025",
    status: "In Progress",
    statusVariant: "info"
  },
  {
    name: "Django Development",
    date: "10 Jan 2025",
    status: "Pending",
    statusVariant: "warning"
  },
  {
    name: "Web Development",
    date: "10 Jan 2025",
    status: "Cancelled",
    statusVariant: "danger"
  },
  {
    name: "Web Design",
    date: "10 Jan 2025",
    status: "In Progress",
    statusVariant: "info"
  },
];

const MyTaskTable = () => {
  return (
    <Table className="table-auto border-spacing-0 border-separate">
      <TableHeader>
        <TableRow className="border-0">
          <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600 rounded-tl-lg">
            Project Name
          </TableHead>
          <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600">
            Deadline
          </TableHead>
          <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600 rounded-tr-lg text-center">
            Status
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order, index) => {
          const isLast = index === orders.length - 1;
          return (
            <TableRow key={index}>
              <TableCell
                className={`py-4.5 px-4 first:border-s last:border-e border-b border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""
                  }`}
              >
                {order.name}
              </TableCell>
              <TableCell
                className={`py-4.5 px-4 first:border-s last:border-e border-b border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""
                  }`}
              >
                {order.date}
              </TableCell>
              <TableCell
                className={`py-4.5 px-4 first:border-s last:border-e border-b border-neutral-200 dark:border-slate-600 text-center ${isLast ? "rounded-br-lg" : ""
                  }`}
              >
                <Badge variant={order.statusVariant}>{order.status}</Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default MyTaskTable;
