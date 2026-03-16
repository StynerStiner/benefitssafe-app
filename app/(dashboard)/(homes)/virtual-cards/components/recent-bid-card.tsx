import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import CustomSelect from '@/components/shared/custom-select';
import RecentBidTable from '@/components/table/recent-bid-table';

const RecentBidCard = ({ cards }: { cards: unknown[] }) => {
    return (
        <>
            <Card className="card !p-4">
                <CardContent className="px-0">
                    <div className="flex items-center flex-wrap gap-2 justify-between mb-5">
                        <h6 className="font-bold text-lg mb-0">Recent Card Activity</h6>
                        <CustomSelect
                            placeholder="All Items"
                            options={["All Items", "New Item", "Trending Item", "Old Item"]}
                        />
                    </div>

                    <RecentBidTable />

                </CardContent>
            </Card>
        </>
    );
};

export default RecentBidCard;