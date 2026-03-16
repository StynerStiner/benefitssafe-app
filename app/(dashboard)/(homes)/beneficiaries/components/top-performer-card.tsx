import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from "@/components/ui/card";

interface Beneficiary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  addressCity: string | null;
  addressState: string | null;
  _count?: { grantsAsBeneficiary?: number; expenseRequests?: number };
}

const TopPerformerCard = ({ beneficiaries }: { beneficiaries: Beneficiary[] }) => {
  const sorted = [...beneficiaries]
    .sort((a, b) => (b._count?.grantsAsBeneficiary || 0) - (a._count?.grantsAsBeneficiary || 0))
    .slice(0, 6);

  const colors = ["bg-blue-600", "bg-green-500", "bg-yellow-500", "bg-purple-500", "bg-red-500", "bg-cyan-500"];

  return (
    <Card className="card">
      <CardContent className="card-body p-0">
        <div className="flex items-center justify-between">
          <h6 className="mb-3 font-semibold text-lg">Most Active Beneficiaries</h6>
          <CommonLink />
        </div>

        <div className="mt-4 space-y-7.5">
          {sorted.length === 0 ? (
            <p className="text-sm text-neutral-500">No beneficiaries found</p>
          ) : (
            sorted.map((b, index) => {
              const initials = `${b.firstName[0] || ""}${b.lastName[0] || ""}`;
              const location = [b.addressCity, b.addressState].filter(Boolean).join(", ") || "No location";
              const grantCount = b._count?.grantsAsBeneficiary || 0;
              return (
                <div
                  className="flex items-center justify-between gap-2"
                  key={b.id}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-10 h-10 rounded-full ${colors[index % colors.length]} text-white flex items-center justify-center text-sm font-semibold shrink-0`}>
                      {initials}
                    </span>
                    <div className="grow">
                      <h6 className="text-base mb-0 font-medium">
                        {b.firstName} {b.lastName}
                      </h6>
                      <span className="text-sm text-neutral-500 dark:text-neutral-300 font-medium">
                        {location}
                      </span>
                    </div>
                  </div>
                  <span className="text-neutral-600 dark:text-neutral-100 text-base font-medium">
                    {grantCount} grant{grantCount !== 1 ? "s" : ""}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TopPerformerCard;
