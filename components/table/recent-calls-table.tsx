import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import UserAvatar from "@/components/shared/user-avatar";

interface ActivityStatus {
    label: string;
    type: "resolved" | "dropped" | "pending" | "danger" | "info";
}

export interface RecentCallsTableTypeItem {
    customer: {
        name: string;
        avatarUrl?: string | null;
    };
    type: string;
    duration: string;
    time: string;
    status: ActivityStatus;
}

interface RecentCallsTableProps {
    data?: RecentCallsTableTypeItem[];
}

const RecentCallsTableContents: RecentCallsTableTypeItem[] = [];


const RecentCallsTable = ({ data }: RecentCallsTableProps) => {
    const tableData = data || [];
    return (
        <Table className="table-auto border-spacing-0 border-separate">
            <TableHeader>
                <TableRow>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-start">
                        User
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Action
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Entity
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Date
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Status
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {tableData.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-neutral-500 dark:text-neutral-400">
                            No audit entries recorded yet
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

                            <TableCell className={` ${isLast ? "border-0" : "border-b border-neutral-200"} dark:border-neutral-600 py-3.5 px-6 text-center text-green-500 font-semibold ${item.type === "Outbound" ? "text-yellow-600" : ""}`}>{item.type}</TableCell>

                            <TableCell className={` ${isLast ? "border-0" : "border-b border-neutral-200"} dark:border-neutral-600 py-3.5 px-6 text-center`}>{item.duration}</TableCell>

                            <TableCell className={` ${isLast ? "border-0" : "border-b border-neutral-200"} dark:border-neutral-600 py-3.5 px-6 text-center`}>{item.time}</TableCell>

                            <TableCell className={` ${isLast ? "border-0" : "border-b border-neutral-200"} dark:border-neutral-600 py-3.5 px-6 text-center`}>
                                <span
                                    className={`px-4 py-1.5 rounded-md font-medium text-sm
                                    ${item.status.type === "resolved" && "bg-green-500/15 text-green-600 dark:text-green-600"}
                                    ${item.status.type === "dropped" && "bg-yellow-500/15 text-yellow-600 dark:text-yellow-600"}
                                    ${item.status.type === "pending" && "bg-purple-500/15 text-purple-600 dark:text-purple-600"}
                                    ${item.status.type === "danger" && "bg-red-500/15 text-red-600 dark:text-red-600"}
                                    ${item.status.type === "info" && "bg-cyan-500/15 text-cyan-600 dark:text-cyan-600"}
                                `}
                                >
                                    {item.status.label}
                                </span>
                            </TableCell>
                        </TableRow>
                    )
                })}
            </TableBody>
        </Table>
    );
};

export default RecentCallsTable;
