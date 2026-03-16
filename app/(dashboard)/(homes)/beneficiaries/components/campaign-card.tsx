import CustomSelect from '@/components/shared/custom-select';
import { Card, CardContent } from '@/components/ui/card';
import { UserPlus, UserCheck, Mail, FileUp } from 'lucide-react';

const CampaignCard = ({ beneficiaries }: { beneficiaries: unknown[] }) => {
  return (
    <Card className="card h-full rounded-lg border-0">
      <CardContent className="card-body p-0">
        <div className="flex items-center flex-wrap gap-2 justify-between">
          <h6 className="mb-0 font-bold text-lg">Enrollment Sources</h6>
          <CustomSelect
            placeholder="Yearly"
            options={["Yearly", "Monthly", "Weekly", "Today"]}
          />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 not-last:mb-5.5">
            <div className="flex items-center">
              <span className="text-2xl line-height-1 flex align-content-center shrink-0 text-orange-500 dark:text-orange-500">
                <UserPlus />
              </span>
              <span className="text-neutral-600 dark:text-neutral-200 font-medium text-sm ps-4">Admin Added</span>
            </div>
            <div className="flex items-center gap-2 w-full">
              <div className="ms-auto">
                <div className="w-[66px] bg-gray-200 rounded-full h-2.5 dark:bg-gray-600">
                  <div className="bg-orange-500 h-2.5 rounded-full w-[60%]"></div>
                </div>
              </div>
              <span className="text-neutral-500 dark:text-neutral-300 font-xs font-semibold">60%</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 not-last:mb-5.5">
            <div className="flex items-center">
              <span className="text-2xl line-height-1 flex align-content-center shrink-0 text-green-500 dark:text-green-500">
                <UserCheck />
              </span>
              <span className="text-neutral-600 dark:text-neutral-200 font-medium text-sm ps-4">Self-Enrolled</span>
            </div>
            <div className="flex items-center gap-2 w-full">
              <div className="ms-auto">
                <div className="w-[66px] bg-gray-200 rounded-full h-2.5 dark:bg-gray-600">
                  <div className="bg-green-500 h-2.5 rounded-full w-[20%]"></div>
                </div>
              </div>
              <span className="text-neutral-500 dark:text-neutral-300 font-xs font-semibold">20%</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 not-last:mb-5.5">
            <div className="flex items-center">
              <span className="text-2xl line-height-1 flex align-content-center shrink-0 text-primary dark:text-primary">
                <Mail />
              </span>
              <span className="text-neutral-600 dark:text-neutral-200 font-medium text-sm ps-4">Invited</span>
            </div>
            <div className="flex items-center gap-2 w-full">
              <div className="ms-auto">
                <div className="w-[66px] bg-gray-200 rounded-full h-2.5 dark:bg-gray-600">
                  <div className="bg-primary h-2.5 rounded-full w-[15%]"></div>
                </div>
              </div>
              <span className="text-neutral-500 dark:text-neutral-300 font-xs font-semibold">15%</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 not-last:mb-5.5">
            <div className="flex items-center">
              <span className="text-2xl line-height-1 flex align-content-center shrink-0 text-purple-600 dark:text-purple-500">
                <FileUp />
              </span>
              <span className="text-neutral-600 dark:text-neutral-200 font-medium text-sm ps-4">Imported</span>
            </div>
            <div className="flex items-center gap-2 w-full">
              <div className="ms-auto">
                <div className="w-[66px] bg-gray-200 rounded-full h-2.5 dark:bg-gray-600">
                  <div className="bg-purple-600 h-2.5 rounded-full w-[5%]"></div>
                </div>
              </div>
              <span className="text-neutral-500 dark:text-neutral-300 font-xs font-semibold">5%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CampaignCard;