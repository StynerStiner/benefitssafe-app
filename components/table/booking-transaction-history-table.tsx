import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
interface ActivityStatus {
    label: string;
    type: "success" | "warning" | "purple";
}

interface BookingTransactionHistoryTypeItem {
    customer: {
        name: string;
        initials: string;
        iconBg: string;
    };
    id: string;
    duration: string;
    amount: string;
    date: string;
    status: ActivityStatus;
}

interface Grant {
    id: string;
    name: string;
    totalAmount: string;
    spentAmount: string;
    status: string;
}

const iconBgColors = ["bg-blue-500", "bg-green-500", "bg-teal-500", "bg-neutral-500", "bg-yellow-500", "bg-purple-500", "bg-red-500"];

function getStatusType(status: string): "success" | "warning" | "purple" {
    if (status === "ACTIVE" || status === "COMPLETED") return "success";
    if (status === "SUSPENDED") return "warning";
    return "purple";
}

function getStatusLabel(status: string): string {
    if (status === "ACTIVE") return "Standard";
    if (status === "SUSPENDED") return "Enhanced Review";
    if (status === "DRAFT") return "Pending";
    if (status === "COMPLETED") return "Completed";
    return status;
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

function formatAmount(amount: string): string {
    const num = parseFloat(amount || "0");
    return `$${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const bookingTransactionsHistoryTableContents: BookingTransactionHistoryTypeItem[] = [
    {
        customer: {
            name: "Creative Writing Fellowship",
            initials: "CW",
            iconBg: "bg-blue-500",
        },
        id: "3 categories",
        duration: "290 days",
        amount: "$25,000",
        date: "Active",
        status: { label: "Standard", type: "success" },
    },
    {
        customer: {
            name: "Digital Skills Training",
            initials: "DS",
            iconBg: "bg-green-500",
        },
        id: "3 categories",
        duration: "198 days",
        amount: "$15,000",
        date: "Active",
        status: { label: "Standard", type: "success" },
    },
    {
        customer: {
            name: "Housing Stability Support",
            initials: "HS",
            iconBg: "bg-teal-500",
        },
        id: "3 categories",
        duration: "471 days",
        amount: "$50,000",
        date: "Active",
        status: { label: "Enhanced Review", type: "warning" },
    },
    {
        customer: {
            name: "Artist Residency Grant",
            initials: "AR",
            iconBg: "bg-neutral-500",
        },
        id: "3 categories",
        duration: "Ended",
        amount: "$8,000",
        date: "Completed",
        status: { label: "Standard", type: "success" },
    },
    {
        customer: {
            name: "Emergency Relief Fund",
            initials: "ER",
            iconBg: "bg-yellow-500",
        },
        id: "0 categories",
        duration: "290 days",
        amount: "$10,000",
        date: "Draft",
        status: { label: "Pending", type: "purple" },
    },
];

const BookingTransactionHistoryTable = ({ grants }: { grants?: Grant[] }) => {
    // Build table data from real grants if available, otherwise use static fallback
    const tableData: BookingTransactionHistoryTypeItem[] = (grants && grants.length > 0)
        ? grants.map((grant, index) => {
            const total = parseFloat(grant.totalAmount || "0");
            const spent = parseFloat(grant.spentAmount || "0");
            const pctUsed = total > 0 ? Math.round((spent / total) * 100) : 0;
            return {
                customer: {
                    name: grant.name,
                    initials: getInitials(grant.name),
                    iconBg: iconBgColors[index % iconBgColors.length],
                },
                id: `${pctUsed}% used`,
                duration: formatAmount(grant.spentAmount) + " spent",
                amount: formatAmount(grant.totalAmount),
                date: grant.status.charAt(0) + grant.status.slice(1).toLowerCase(),
                status: { label: getStatusLabel(grant.status), type: getStatusType(grant.status) },
            };
        })
        : bookingTransactionsHistoryTableContents;

    return (
        <Table className="table-auto border-spacing-0 border-separate">
            <TableHeader>
                <TableRow>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-start">
                        Grant
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Categories
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Duration
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Budget
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Status
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Policy
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {tableData.map((item, index) => (
                    <TableRow key={index}>
                        {/* Customer */}
                        <TableCell className="py-3.5 px-6 text-start">
                            <div className="flex items-center">
                                <span
                                    className={`w-10 h-10 rounded-md me-3 flex items-center justify-center text-white text-xs font-semibold shrink-0 ${item.customer.iconBg}`}
                                >
                                    {item.customer.initials}
                                </span>
                                <div>
                                    <h6 className="text-base mb-0">{item.customer.name}</h6>
                                </div>
                            </div>
                        </TableCell>

                        {/* ID */}
                        <TableCell className="py-3.5 px-6 text-center">{item.id}</TableCell>

                        {/* duration */}
                        <TableCell className="py-3.5 px-6 text-center">{item.duration}</TableCell>

                        {/* Amount */}
                        <TableCell className="py-3.5 px-6 text-center">{item.amount}</TableCell>

                        {/* date */}
                        <TableCell className="py-3.5 px-6 text-center">{item.date}</TableCell>

                        {/* Status */}
                        <TableCell className="py-3.5 px-6 text-center">
                            <span
                                className={`px-4 py-1.5 rounded-md font-medium text-sm
                                    ${item.status.type === "success" && "bg-green-500/15 text-green-600 dark:text-green-600"}
                                    ${item.status.type === "warning" && "bg-yellow-500/15 text-yellow-600 dark:text-yellow-600"}
                                    ${item.status.type === "purple" && "bg-purple-500/15 text-purple-600 dark:text-purple-600"}
                                `}
                            >
                                {item.status.label}
                            </span>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

export default BookingTransactionHistoryTable;
