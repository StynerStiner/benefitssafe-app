"use client";

import CommonLink from "@/components/shared/common-link";
import BookingTransactionHistoryTable from "@/components/table/booking-transaction-history-table";
import { Card, CardContent } from "@/components/ui/card";

interface Grant {
    id: string;
    name: string;
    totalAmount: string;
    spentAmount: string;
    status: string;
}

const TransactionHistory = ({ grants }: { grants: Grant[] }) => {
    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0 h-full">
                <div className="flex items-center flex-wrap gap-2 justify-between px-6 py-4">
                    <h6 className="font-bold text-lg mb-0">Grants Under This Policy</h6>
                    <CommonLink />
                </div>

                {/* Transactions List */}
                <div className="">
                    <BookingTransactionHistoryTable grants={grants} />
                </div>
            </CardContent>
        </Card>
    );
};

export default TransactionHistory;
