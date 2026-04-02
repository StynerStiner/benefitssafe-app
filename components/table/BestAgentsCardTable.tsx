import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import UserAvatar from "@/components/shared/user-avatar";

export interface BestAgentsCardTableTypeItem {
    customer: {
        name: string;
        avatarUrl?: string | null;
    };
    amounts: string;
    startDate: string;
    endDate: string;
    duration: string;
}

interface BestAgentsCardTableProps {
    data?: BestAgentsCardTableTypeItem[];
}

const BestAgentsCardTableContents: BestAgentsCardTableTypeItem[] = [];


const BestAgentsCardTable = ({ data }: BestAgentsCardTableProps) => {
    const tableData = data || [];
    return (
        <Table className="table-auto border-spacing-0 border-separate">
            <TableHeader>
                <TableRow>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-start">
                        User
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Actions
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Last Active
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Role
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Org
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {tableData.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-neutral-500 dark:text-neutral-400">
                            No user activity recorded yet
                        </TableCell>
                    </TableRow>
                )}
                {tableData.map((item, index) => {
                    const isLast = index === tableData.length - 1;

                    return (
                        <TableRow key={index}>
                            {/* Customer */}
                            <TableCell className={` ${isLast ? "border-0" : "border-b border-neutral-200"} dark:border-neutral-600 py-3.5 px-6 text-start`}>
                                <div className="flex items-center">
                                    <UserAvatar
                                        firstName={item.customer.name.split(" ")[0]}
                                        lastName={item.customer.name.split(" ").slice(1).join(" ")}
                                        avatarUrl={item.customer.avatarUrl}
                                        size={40}
                                        className="me-3"
                                    />
                                    <div>
                                        <h6 className="text-base mb-0 font-medium">{item.customer.name}</h6>
                                    </div>
                                </div>
                            </TableCell>

                            {/* ID */}
                            <TableCell className={` ${isLast ? "border-0" : "border-b border-neutral-200"} dark:border-neutral-600 py-3.5 px-6 text-center`}>{item.amounts}</TableCell>

                            {/* duration */}
                            <TableCell className={` ${isLast ? "border-0" : "border-b border-neutral-200"} dark:border-neutral-600 py-3.5 px-6 text-center`}>{item.startDate}</TableCell>

                            {/* Amount */}
                            <TableCell className={` ${isLast ? "border-0" : "border-b border-neutral-200"} dark:border-neutral-600 py-3.5 px-6 text-center`}>{item.endDate}</TableCell>

                            {/* date */}
                            <TableCell className={` ${isLast ? "border-0" : "border-b border-neutral-200"} dark:border-neutral-600 py-3.5 px-6 text-center`}>{item.duration}</TableCell>
                        </TableRow>
                    )
                })}
            </TableBody>
        </Table>
    );
};

export default BestAgentsCardTable;
