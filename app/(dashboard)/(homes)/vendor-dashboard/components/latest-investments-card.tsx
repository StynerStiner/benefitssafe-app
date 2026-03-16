import CommonLink from "@/components/shared/common-link";
import LatestInvestmentsTable from "@/components/table/latest-investments-table";
import { Card, CardContent } from "@/components/ui/card";
import React from "react";

const LatestInvestmentsCard = () => {
  return (
    <Card className="card h-full border-0">
      <CardContent className="card-body p-0">
        <div className="flex items-center flex-wrap gap-2 justify-between mb-5">
          <h6 className="mb-0 font-bold text-lg">Latest Investments</h6>
          <CommonLink />
        </div>
        <LatestInvestmentsTable />
      </CardContent>
    </Card>
  );
};
export default LatestInvestmentsCard;
