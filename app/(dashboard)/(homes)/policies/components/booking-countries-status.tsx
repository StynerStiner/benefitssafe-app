import WorldMapChart from '@/components/charts/world-map-chart';
import CountryList from '@/components/shared/country-list';
import { Card, CardContent } from '@/components/ui/card';

interface Policy {
    allowedCategories: string[] | null;
    blockedCategories: string[] | null;
}

const BookingCountriesStatus = ({ policy }: { policy: Policy | null }) => {
    // Derive coverage data from policy categories
    const coverageData = (() => {
        if (!policy) return undefined;
        const allowed = Array.isArray(policy.allowedCategories) ? policy.allowedCategories : [];
        const blocked = Array.isArray(policy.blockedCategories) ? policy.blockedCategories : [];
        // Show allowed categories as coverage items with count=1 each (presence indicator)
        const items = [
            ...allowed.map((cat: string) => ({ name: cat, count: 1 })),
            ...blocked.map((cat: string) => ({ name: `${cat} (Blocked)`, count: 0 })),
        ];
        return items.length > 0 ? items : undefined;
    })();

    return (
      <Card className="card h-full rounded-lg border-0 !p-0 dark:bg-[#273142]">
        <CardContent className="card-body p-6">
            <div className="flex items-center flex-wrap gap-2 justify-between pb-6">
                <h6 className="mb-0 font-bold text-lg">Policy Coverage</h6>
            </div>

            <div className="bg-neutral-100 dark:bg-slate-700/50 h-[160px] overflow-hidden rounded-xl">
              <WorldMapChart mapHeight={400} />
            </div>

            <div className="max-h-[266px] overflow-y-auto scrollbar-thin scrollbar-invisible hover:scrollbar-visible mt-6 pe-2">
              <CountryList data={coverageData} />
            </div>

        </CardContent>
    </Card>
    );
};

export default BookingCountriesStatus;