"use client";

import CommonLink from "@/components/shared/common-link";
import BestAgentsCardTable from "@/components/table/BestAgentsCardTable";
import { Card, CardContent } from "@/components/ui/card";

const BestAgentsCard = ({ auditLogs }: { auditLogs: unknown[] }) => {
    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0 h-full">
                <div className="flex items-center flex-wrap gap-2 justify-between px-6 py-4">
                    <h6 className="font-bold text-lg mb-0">Most Active Users</h6>
                    <CommonLink />
                </div>

                <div className="">
                    <BestAgentsCardTable />
                </div>
            </CardContent>
        </Card>
    );
};

export default BestAgentsCard;
