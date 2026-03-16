"use client";

import React from "react";
import Image from "next/image";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { users } from "./data";
import { Badge } from "../ui/badge";

const LatestRegisteredTable = () => {
  const slicedUsers = users.slice(0, 5);

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
        {slicedUsers.map((user, index) => {
          const isLastRow = index === slicedUsers.length - 1;
          return (
            <TableRow key={index}>
              <TableCell
                className={`py-3 px-4 border-b border-neutral-200 dark:border-slate-600 first:border-s last:border-e ${
                  isLastRow ? "rounded-bl-lg" : ""
                }`}
              >
                <div className="flex items-center">
                  <Image
                    src={user.image}
                    alt={user.name}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full shrink-0 me-2 overflow-hidden"
                  />
                  <div>
                    <h6 className="text-base mb-0 font-medium">{user.name}</h6>
                    <span className="text-sm text-neutral-600 dark:text-neutral-300">
                      {user.email}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell
                className={`py-3 px-4 border-b border-neutral-200 dark:border-slate-600 first:border-s last:border-e ${
                  isLastRow ? "rounded-bl-lg" : ""
                }`}
              >
                {user.registered}
              </TableCell>
              <TableCell
                className={`py-3 px-4 border-b border-neutral-200 dark:border-slate-600 first:border-s last:border-e ${
                  isLastRow ? "rounded-bl-lg" : ""
                }`}
              >
                {user.plan}
              </TableCell>
              <TableCell
                className={`py-3 px-4 border-b border-neutral-200 dark:border-slate-600 first:border-s last:border-e ${
                  isLastRow ? "rounded-br-lg" : ""
                } text-center`}
              >
                <Badge variant={user.statusVariant} className="rounded-[50rem]">
                  {user.status}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default LatestRegisteredTable;
