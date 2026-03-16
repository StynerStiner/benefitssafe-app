import WorldMapChart from '@/components/charts/world-map-chart';
import CountryList from '@/components/shared/country-list';
import CustomSelect from '@/components/shared/custom-select';
import { Card, CardContent } from '@/components/ui/card';

const BookingCountriesStatus = ({ policy }: { policy: unknown }) => {
    return (
      <Card className="card h-full rounded-lg border-0 !p-0 dark:bg-[#273142]">
        <CardContent className="card-body p-6">
            <div className="flex items-center flex-wrap gap-2 justify-between pb-6">
                <h6 className="mb-0 font-bold text-lg">Policy Coverage</h6>
                <CustomSelect
                  placeholder="Yearly"
                  options={["Yearly", "Monthly", "Weekly", "Today"]}
                />
            </div>

            <div className="bg-neutral-100 dark:bg-slate-700/50 h-[160px] overflow-hidden rounded-xl">
              <WorldMapChart mapHeight={400} />
            </div> 

            <div className="max-h-[266px] overflow-y-auto scrollbar-thin scrollbar-invisible hover:scrollbar-visible mt-6 pe-2">
              <CountryList/>
            </div>
          
        </CardContent>
    </Card>
    );
};

export default BookingCountriesStatus;