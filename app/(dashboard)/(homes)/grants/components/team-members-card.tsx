import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Grant {
    id: string;
    name: string;
    totalAmount: string;
    spentAmount: string;
    beneficiary: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    } | null;
}

interface BeneficiarySummary {
    id: string;
    name: string;
    email: string;
    grantCount: number;
    progress: number;
    progressColor: string;
}

const progressColors = [
    "bg-purple-500",
    "bg-yellow-500",
    "bg-cyan-500",
    "bg-green-500",
    "bg-red-600",
];

const TeamMembersCard = ({ grants }: { grants: Grant[] }) => {
    // Aggregate beneficiaries from grants
    const beneficiaryMap = new Map<string, BeneficiarySummary>();

    grants.forEach((grant) => {
        if (!grant.beneficiary) return;
        const b = grant.beneficiary;
        const existing = beneficiaryMap.get(b.id);
        const total = parseFloat(grant.totalAmount || "0");
        const spent = parseFloat(grant.spentAmount || "0");
        const progress = total > 0 ? Math.round((spent / total) * 100) : 0;

        if (existing) {
            existing.grantCount += 1;
            existing.progress = Math.round((existing.progress + progress) / 2);
        } else {
            beneficiaryMap.set(b.id, {
                id: b.id,
                name: `${b.firstName} ${b.lastName}`,
                email: b.email,
                grantCount: 1,
                progress,
                progressColor: progressColors[beneficiaryMap.size % progressColors.length],
            });
        }
    });

    const beneficiaries = Array.from(beneficiaryMap.values());

    return (
        <Card className="card p-6 border-0 rounded-xl shadow-none">
            <CardContent className="p-0">
                <div className="pb-4 flex items-center justify-between flex-wrap gap-2">
                    <h6 className="font-semibold text-lg mb-0 text-foreground">Beneficiaries</h6>
                    <CommonLink />
                </div>
                <div className="p-0">
                    <div className="table-responsive scroll-sm">
                        <Table className="table-auto border-spacing-0 border-separate">
                            <TableHeader>
                                <TableRow className="border-0">
                                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-13 border-t border-neutral-200 dark:border-slate-600 rounded-tl-lg">
                                        Beneficiary
                                    </TableHead>
                                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-4 h-13 border-t border-neutral-200 dark:border-slate-600">
                                        Grants
                                    </TableHead>
                                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-4 h-13 border-t border-neutral-200 dark:border-slate-600 rounded-tr-lg text-center">
                                        Disbursed
                                    </TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {beneficiaries.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="py-4 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 text-center text-neutral-500">
                                            No beneficiaries found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    beneficiaries.map((member, index) => {
                                        const isLast = index === beneficiaries.length - 1;
                                        return (
                                            <TableRow key={member.id}>
                                                <TableCell
                                                    className={`py-4 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-[40px] h-[40px] rounded-full bg-neutral-200 dark:bg-slate-600 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                                                            {member.name.split(" ").map(n => n[0]).join("")}
                                                        </span>
                                                        <div>
                                                            <h6 className="text-base font-medium mb-0">
                                                                {member.name}
                                                            </h6>
                                                            <span className="text-sm text-neutral-500 dark:text-neutral-300 font-medium">
                                                                {member.email}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                <TableCell
                                                    className={`py-4 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""}`}
                                                >
                                                    {member.grantCount}
                                                </TableCell>

                                                <TableCell
                                                    className={`py-4 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 text-center ${isLast ? "rounded-br-lg" : ""}`}
                                                >
                                                    <div className="max-w-[112px] mx-auto w-full">
                                                        <div className="h-2 rounded-full bg-neutral-600/20 overflow-hidden">
                                                            <div
                                                                className={`h-2 rounded-full ${member.progressColor}`}
                                                                style={{ width: `${member.progress}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default TeamMembersCard;
