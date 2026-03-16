import BuyBalanceContent from "@/components/shared/buy-balance-content";
import SellBalanceContent from "@/components/shared/sell-balance-content";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TotalBalanceCard = ({ grants }: { grants: { remainingAmount: string }[] }) => {
    const totalRemaining = grants.reduce((s, g) => s + parseFloat(g.remainingAmount || "0"), 0);
  return (
    <Card className="card h-full border-0">
      <CardContent className="card-body p-0">
        <span className="mb-1.5 text-sm text-neutral-500 dark:text-neutral-300">
          Total Grant Balance
        </span>
        <h6 className="mb-0">${totalRemaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}</h6>

        <Tabs defaultValue="buy" className="">
          <TabsList className="grid w-full grid-cols-2 bg-neutral-100 dark:bg-slate-700 border border-neutral-200 dark:border-slate-600 p-1 rounded-md h-[unset] mt-7 mb-6">
            <TabsTrigger
              value="buy"
              className="h-11 data-[state=active]:bg-primary data-[state=active]:text-white dark:data-[state=active]:bg-primary dark:data-[state=active]:text-white duration-300 !shadow-none dark:text-white"
            >
              Credits
            </TabsTrigger>
            <TabsTrigger
              value="sell"
              className="h-11 data-[state=active]:bg-primary data-[state=active]:text-white dark:data-[state=active]:bg-primary dark:data-[state=active]:text-white duration-300 !shadow-none dark:text-white"
            >
              Debits
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buy">
            <BuyBalanceContent />
          </TabsContent>

          <TabsContent value="sell">
            <SellBalanceContent />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TotalBalanceCard;
