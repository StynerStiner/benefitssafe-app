import CommonLink from '@/components/shared/common-link';
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Beneficiary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
  benefitPrograms: Record<string, boolean> | null;
  isActive: boolean;
}

const programLabels: Record<string, string> = {
  ssi: "SSI",
  ssdi: "SSDI",
  mediCal: "Medi-Cal",
  medicaid: "Medicaid",
  able: "ABLE",
  calFresh: "CalFresh",
  ihss: "IHSS",
};

const TodoListRecentCard = ({ beneficiaries }: { beneficiaries: Beneficiary[] }) => {
    const recent = [...beneficiaries]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    const active = beneficiaries.filter((b) => b.isActive).slice(0, 5);

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

    const getPrograms = (bp: Record<string, boolean> | null) => {
        if (!bp) return [];
        return Object.entries(bp).filter(([, v]) => v).map(([k]) => programLabels[k] || k);
    };

    const renderList = (list: Beneficiary[]) => (
        <div className="flex flex-col gap-4">
            {list.length === 0 ? (
                <p className="text-sm text-neutral-500">No beneficiaries</p>
            ) : (
                list.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-2">
                        <div>
                            <h6 className="text-sm font-medium mb-0">{b.firstName} {b.lastName}</h6>
                            <span className="text-xs text-neutral-500 dark:text-neutral-300">{b.email}</span>
                        </div>
                        <div className="text-end">
                            <span className="text-xs text-neutral-500 block">{formatDate(b.createdAt)}</span>
                            <div className="flex flex-wrap gap-1 mt-1 justify-end">
                                {getPrograms(b.benefitPrograms).map((p) => (
                                    <span key={p} className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-600/25 text-blue-600 dark:text-blue-400 font-medium">{p}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    return (
        <Card className="card !p-0">
            <CardContent className="px-0">
                <Tabs defaultValue="todoList" className="gap-0">
                    <div className="flex items-center justify-between border-b border-neutral-200 dark:border-slate-600">
                        <TabsList className='bg-transparent dark:bg-transparent rounded-none h-[50px]  p-0'>
                            <TabsTrigger value="todoList" className='py-2.5 px-4 font-medium text-base inline-flex items-center gap-3 dark:bg-transparent text-neutral-600 hover:text-primary dark:text-white dark:hover:text-blue-500 border-0 border-b-1 border-transparent dark:border-transparent data-[state=active]:border-primary dark:data-[state=active]:border-primary dark:data-[state=active]:bg-transparent rounded-[0] data-[state=active]:shadow-none cursor-pointer translate-y-px'>
                                Recently Added
                            </TabsTrigger>
                            <TabsTrigger value="recentLeads" className='py-2.5 px-4 font-medium text-base inline-flex items-center gap-3 dark:bg-transparent text-neutral-600 hover:text-primary dark:text-white dark:hover:text-blue-500 border-0 border-b-1 border-transparent dark:border-transparent data-[state=active]:border-primary dark:data-[state=active]:border-primary dark:data-[state=active]:bg-transparent rounded-[0] data-[state=active]:shadow-none cursor-pointer translate-y-px'>
                                Active
                            </TabsTrigger>
                        </TabsList>
                        <div className="pe-6">
                            <CommonLink />
                        </div>
                    </div>

                    <div className="p-6">
                        <TabsContent value="todoList">
                            {renderList(recent)}
                        </TabsContent>
                        <TabsContent value="recentLeads">
                            {renderList(active)}
                        </TabsContent>
                    </div>
                </Tabs>
            </CardContent>
        </Card>
    );
};

export default TodoListRecentCard;
