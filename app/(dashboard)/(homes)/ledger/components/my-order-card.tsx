import { Card, CardContent } from '@/components/ui/card';
import CustomSelect from '@/components/shared/custom-select';
import React from 'react';
import MyOrderTable from '@/components/table/my-order-table';

const MyOrderCard = ({ transactions }: { transactions: unknown[] }) => {
    return (
        <Card className="card h-full rounded-lg border-0">
            <CardContent className="card-body p-0">
                <div className="flex items-center flex-wrap gap-2 justify-between mb-5">
                    <h6 className="mb-0 font-bold text-lg">Recent Transactions</h6>
                    
                    <CustomSelect
                        placeholder="Yearly"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                    />
                </div>

                <MyOrderTable/>
            
            </CardContent>
        </Card>
    );
};

export default MyOrderCard;