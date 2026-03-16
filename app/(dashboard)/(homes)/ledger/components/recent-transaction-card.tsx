import CommonLink from "@/components/shared/common-link";
import RecentTransactionTable from "@/components/table/recent-transaction-table";
import { Card, CardContent } from "@/components/ui/card";
import React from "react";

const RecentTransactionCard = ({ ledgerEntries }: { ledgerEntries: unknown[] }) => {
  return (
    <Card className="card h-full border-0">
      <CardContent className="card-body p-0">
        <div className="flex items-center flex-wrap gap-2 justify-between mb-5">
          <h6 className="mb-0 font-bold text-lg">Recent Activity</h6>
          <CommonLink />
        </div>
        <RecentTransactionTable />
      </CardContent>
    </Card>
  );
};

export default RecentTransactionCard;
