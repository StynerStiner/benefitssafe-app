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
                            <TabsTrigger value="art" className='font-semibold rounded-full px-5 py-0.5 h-[34px] border border-neutral-300 dark:border-neutral-800 text-neutral-900 dark:border-neutral-300 capitalize dark:text-white data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-white dark:data-[state=active]:border-primary dark:data-[state=active]:bg-primary dark:data-[state=active]:text-white'>
                                Art
                            </TabsTrigger>
                            <TabsTrigger value="music" className='font-semibold rounded-full px-5 py-0.5 h-[34px] border border-neutral-300 dark:border-neutral-800 text-neutral-900 dark:border-neutral-300 capitalize dark:text-white data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-white dark:data-[state=active]:border-primary dark:data-[state=active]:bg-primary dark:data-[state=active]:text-white'>
                                music
                            </TabsTrigger>
                            <TabsTrigger value="utility" className='font-semibold rounded-full px-5 py-0.5 h-[34px] border border-neutral-300 dark:border-neutral-800 text-neutral-900 dark:border-neutral-300 capitalize dark:text-white data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-white dark:data-[state=active]:border-primary dark:data-[state=active]:bg-primary dark:data-[state=active]:text-white'>
                                utility
                            </TabsTrigger>
                            <TabsTrigger value="fashion" className='font-semibold rounded-full px-5 py-0.5 h-[34px] border border-neutral-300 dark:border-neutral-800 text-neutral-900 dark:border-neutral-300 capitalize dark:text-white data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-white dark:data-[state=active]:border-primary dark:data-[state=active]:bg-primary dark:data-[state=active]:text-white'>
                                fashion
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

                    <TabsContent value="art">
                        <Card className="card !p-4">
                            <CardContent className="px-0">
                                <TrendingNftWidgets category="art" />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="music">
                        <Card className="card !p-4">
                            <CardContent className="px-0">
                                <TrendingNftWidgets category="music" />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="utility">
                        <Card className="card !p-4">
                            <CardContent className="px-0">
                                <TrendingNftWidgets category="utility" />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="fashion">
                        <Card className="card !p-4">
                            <CardContent className="px-0">
                                <TrendingNftWidgets category="fashion" />
                            </CardContent>
                        </Card>
                    </TabsContent>

                </Tabs>
            </div>
        </>
    );
};

export default TrendingNftCard;