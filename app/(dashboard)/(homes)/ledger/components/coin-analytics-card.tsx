import { Card, CardContent } from '@/components/ui/card';
import CustomSelect from '@/components/shared/custom-select';
import { ArrowUp } from 'lucide-react';
import React from 'react';
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import CoinAnalyticsChart from '@/components/charts/coin-analytics-chart';

const CoinAnalyticsCard = ({ grants }: { grants: unknown[] }) => {
    return (
        <Card className="card h-full rounded-lg border-0">
            <CardContent className="card-body p-0">
                <div className="flex items-center flex-wrap gap-2 justify-between">
                    <h6 className="mb-0 font-bold text-lg">Grant Balances</h6>

                    <RadioGroup defaultValue="grant1" className='flex items-center gap-4'>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="grant1" id="grant1" className='border border-primary' />
                            <Label htmlFor="grant1">Grant 1</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="grant2" id="grant2" className='border border-primary' />
                            <Label htmlFor="grant2">Grant 2</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="grant3" id="grant3" className='border border-primary' />
                            <Label htmlFor="grant3">Grant 3</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="all" id="all" className='border border-primary' />
                            <Label htmlFor="all">All</Label>
                        </div>
                    </RadioGroup>

                    <CustomSelect
                        placeholder="Yearly"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                    />
                </div>

                <div className="flex items-center gap-2 mt-3">
                    <h6 className="font-semibold mb-0">$20,179</h6>
                    <p className="text-sm mb-0 flex items-center gap-1">
                        Creative Writing Fellowship
                        <span className="bg-green-100 dark:bg-green-600/25 border border-green-600/25 px-2.5 py-1 rounded-full font-semibold text-green-600 dark:text-green-500 text-sm inline-flex items-center gap-1">
                            10%
                            <ArrowUp className="w-3 h-3" />
                        </span>
                    </p>
                </div>

                <CoinAnalyticsChart />

            </CardContent>
        </Card>
    );
};

export default CoinAnalyticsCard;