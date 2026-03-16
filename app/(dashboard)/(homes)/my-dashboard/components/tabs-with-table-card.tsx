import LatestRegisteredTable from '@/components/table/latest-registered-table';
import LatestSubscribeTable from '@/components/table/latest-subscribe-table';
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TabsWithTableCard = () => {
    return (
        <Card className="card">
            <CardContent className="px-0">
                <Tabs defaultValue="latestRegistered" className="gap-4">
                    <TabsList className='active-gradient bg-transparent dark:bg-transparent rounded-none h-[50px]'>
                        <TabsTrigger value="latestRegistered" className='py-2.5 px-4 font-semibold text-lg inline-flex items-center gap-3 dark:bg-transparent text-neutral-600 hover:text-primary dark:text-white dark:hover:text-blue-500 data-[state=active]:bg-gradient border-0 border-t-2 border-neutral-200 dark:border-neutral-500 data-[state=active]:border-primary dark:data-[state=active]:border-primary rounded-[0] data-[state=active]:shadow-none cursor-pointer'>
                            Latest Registered
                            <span className="text-white px-2 py-0.5 bg-neutral-600 rounded-full text-sm">20</span>
                        </TabsTrigger>
                        <TabsTrigger value="latestSubscribe" className='py-2.5 px-4 font-semibold text-lg inline-flex items-center gap-3 dark:bg-transparent text-neutral-600 hover:text-primary dark:text-white dark:hover:text-blue-500 data-[state=active]:bg-gradient border-0 border-t-2 border-neutral-200 dark:border-neutral-500 data-[state=active]:border-primary dark:data-[state=active]:border-primary rounded-[0] data-[state=active]:shadow-none cursor-pointer'>
                            Latest Subscribe
                            <span className="text-white px-2 py-0.5 bg-neutral-600 rounded-full text-sm">20</span>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="latestRegistered">
                        <LatestRegisteredTable />
                    </TabsContent>
                    <TabsContent value="latestSubscribe">
                        <LatestSubscribeTable />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
};

export default TabsWithTableCard;