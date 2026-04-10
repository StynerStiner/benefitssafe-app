"use client";

import CommonLink from "@/components/shared/common-link";
import BookingTransactionHistoryTable from "@/components/table/booking-transaction-history-table";
import { Card, CardContent } from "@/components/ui/card";

const TransactionHistory = () => {
    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0 h-full">
                <div className="flex items-center flex-wrap gap-2 justify-between px-6 py-4">
                    <h3 className="font-bold text-lg mb-0">Transaction History</h3>
                    <CommonLink />
                </div>

                {/* Transactions List */}
                <div className="">
                    <BookingTransactionHistoryTable />
                </div>
            </CardContent>
        </Card>
    );
};

export default TransactionHistory;
