"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface MyOrdersType {
  id: number;
  rate: string;
  amountEth: string;
  pricePln: string;
  status: string;
}

const initialOrdersData: MyOrdersType[] = [
  {
    id: 1,
    rate: "0.265415.00",
    amountEth: "29.4251512",
    pricePln: "2.154",
    status: "green",
  },
  {
    id: 2,
    rate: "0.265415.00",
    amountEth: "29.4251512",
    pricePln: "2.154",
    status: "green",
  },
  {
    id: 3,
    rate: "0.265415.00",
    amountEth: "29.4251512",
    pricePln: "2.154",
    status: "red",
  },
  {
    id: 4,
    rate: "0.265415.00",
    amountEth: "29.4251512",
    pricePln: "2.154",
    status: "green",
  },
  {
    id: 5,
    rate: "0.265415.00",
    amountEth: "29.4251512",
    pricePln: "2.154",
    status: "red",
  },
  {
    id: 6,
    rate: "0.265415.00",
    amountEth: "29.4251512",
    pricePln: "2.154",
    status: "red",
  },
];

const MyOrderTable = () => {
  const [orders, setOrders] = useState<MyOrdersType[]>(initialOrdersData);

  const removeOrderItem = (id: number) => {
    const filteredData = orders.filter((order) => order.id !== id);
    setOrders(filteredData);
  };

  return (
    <Table className="table-auto border-spacing-0 border-separate">
      <TableHeader>
        <TableRow className="border-0">
          <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base border-t border-neutral-200 dark:border-slate-600 px-4 h-12 border-s rounded-tl-lg">
            Rate
          </TableHead>
          <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base border-t border-neutral-200 dark:border-slate-600 px-4 h-12">
            Amount ETH
          </TableHead>
          <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base border-t border-neutral-200 dark:border-slate-600 px-4 h-12 text-center">
            Price PLN
          </TableHead>
          <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base border-t border-neutral-200 dark:border-slate-600 px-4 h-12 border-e rounded-tr-lg text-center">
            Action
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {orders.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={4}
              className={`py-3.5 px-4 border border-neutral-200 dark:border-slate-600 text-base  rounded-bl-lg rounded-br-lg text-center`}
            >
              <span className="text-sm text-neutral-900 dark:text-white font-semibold">
                No Data Available
              </span>
            </TableCell>
          </TableRow>
        ) : (
          <>
            {orders.map((order, index) => {
              const isLastRow = index === orders.length - 1;

              return (
                <TableRow key={order.id}>
                  <TableCell
                    className={`py-3.5 px-4 border-b border-neutral-200 dark:border-slate-600 text-base first:border-s last:border-e ${
                      isLastRow ? "rounded-bl-lg" : ""
                    }`}
                  >
                    <span
                      className={
                        order.status === "green"
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      {order.rate}
                    </span>
                  </TableCell>

                  <TableCell
                    className={`py-3.5 px-4 border-b border-neutral-200 dark:border-slate-600 text-base first:border-s last:border-e ${
                      isLastRow ? "rounded-bl-lg" : ""
                    }`}
                  >
                    {order.amountEth}
                  </TableCell>

                  <TableCell
                    className={`py-3.5 px-4 border-b border-neutral-200 dark:border-slate-600 text-base text-center first:border-s last:border-e ${
                      isLastRow ? "rounded-bl-lg" : ""
                    }`}
                  >
                    {order.pricePln}
                  </TableCell>

                  <TableCell
                    className={`py-3.5 px-4 border-b border-neutral-200 dark:border-slate-600 text-base first:border-s last:border-e text-center ${
                      isLastRow ? "rounded-br-lg" : ""
                    }`}
                  >
                    <Button
                      variant="link"
                      className={cn(
                        `text-lg text-red-600 dark:text-red-500 cursor-pointer hover:scale-150`
                      )}
                      onClick={() => {
                        removeOrderItem(order.id);
                        toast.success("Table Row has been deleted!");
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </>
        )}
      </TableBody>
    </Table>
  );
};

export default MyOrderTable;
