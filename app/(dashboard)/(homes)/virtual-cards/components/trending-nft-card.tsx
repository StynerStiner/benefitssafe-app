import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TrendingNftWidgets from './trending-nft-widgets';

const TrendingNftCard = ({ cards }: { cards: unknown[] }) => {
    return (
        <>
            <div className="mb-4 mt-8 flx flex-wrap justify-between gap-4">
                <Tabs defaultValue="all" className="gap-4">
                    <div className="flex flex-wrap justify-between gap-4">
                        <h6 className="mb-0">Active Cards</h6>
                        <TabsList className='bg-transparent dark:bg-transparent rounded-none h-[50px] flex items-center gap-2'>
                            <TabsTrigger value="all" className='font-semibold rounded-full px-5 py-0.5 h-[34px] border border-neutral-300 dark:border-neutral-800 text-neutral-900 dark:border-neutral-300 capitalize dark:text-white data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-white dark:data-[state=active]:border-primary dark:data-[state=active]:bg-primary dark:data-[state=active]:text-white'>
                                All
                            </TabsTrigger>
                            <TabsTrigger value="recurring" className='font-semibold rounded-full px-5 py-0.5 h-[34px] border border-neutral-300 dark:border-neutral-800 text-neutral-900 dark:border-neutral-300 capitalize dark:text-white data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-white dark:data-[state=active]:border-primary dark:data-[state=active]:bg-primary dark:data-[state=active]:text-white'>
                                Recurring
                            </TabsTrigger>
                            <TabsTrigger value="single-use" className='font-semibold rounded-full px-5 py-0.5 h-[34px] border border-neutral-300 dark:border-neutral-800 text-neutral-900 dark:border-neutral-300 capitalize dark:text-white data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-white dark:data-[state=active]:border-primary dark:data-[state=active]:bg-primary dark:data-[state=active]:text-white'>
                                Single-Use
                            </TabsTrigger>
                            <TabsTrigger value="multi-vendor" className='font-semibold rounded-full px-5 py-0.5 h-[34px] border border-neutral-300 dark:border-neutral-800 text-neutral-900 dark:border-neutral-300 capitalize dark:text-white data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-white dark:data-[state=active]:border-primary dark:data-[state=active]:bg-primary dark:data-[state=active]:text-white'>
                                Multi-Vendor
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="all">
                        <Card className="card !p-4">
                            <CardContent className="px-0">
                                <TrendingNftWidgets category="all" />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="recurring">
                        <Card className="card !p-4">
                            <CardContent className="px-0">
                                <TrendingNftWidgets category="recurring" />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="single-use">
                        <Card className="card !p-4">
                            <CardContent className="px-0">
                                <TrendingNftWidgets category="single-use" />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="multi-vendor">
                        <Card className="card !p-4">
                            <CardContent className="px-0">
                                <TrendingNftWidgets category="multi-vendor" />
                            </CardContent>
                        </Card>
                    </TabsContent>

                </Tabs>
            </div>
        </>
    );
};

export default TrendingNftCard;