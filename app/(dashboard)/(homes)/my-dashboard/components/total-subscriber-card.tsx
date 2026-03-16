import { Card, CardContent } from '@/components/ui/card';
import React from 'react';
import { ArrowDown } from "lucide-react";
import TotalSubscriberChart from '@/components/charts/total-subscriber-chart';

const TotalSubscriberCard = () => {
    return (
        <Card className="card">
            <CardContent className="card-body p-0">
                <h6 className="mb-3 font-semibold text-lg">Total Subscriber</h6>
                <div className="flex items-center gap-2 mb-5">
                    <h6 className="font-semibold mb-0">5,000</h6>
                    <span className="text-sm font-semibold rounded-full bg-red-100 dark:bg-red-600/25 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-600/50 px-2 py-1.5 line-height-1 flex items-center gap-1">
                        10% <ArrowDown width={14} height={14} />
                    </span>
                    - 20 Per Day
                </div>

                <TotalSubscriberChart />

            </CardContent>
        </Card>
    );
};

export default TotalSubscriberCard;