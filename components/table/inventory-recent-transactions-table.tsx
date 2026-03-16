import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface recentTransactionType {
    sl: string;
    date: string;
    paymentType: string;
    paidAmount: string;
    dueAmount: string;
    payableAmount: string;
};

const recentTransactionContents: recentTransactionType[] = [
    {
        sl: "1",
        date: "14 Jan 2026",
        paymentType: "Creative Writing Fellowship — Grant Agreement",
        paidAmount: "Grant Letter",
        dueAmount: "245 KB",
        payableAmount: "Sarah Mitchell",
    },
    {
        sl: "2",
        date: "02 Feb 2026",
        paymentType: "Adobe CC — Invoice 2026-001",
        paidAmount: "Invoice",
        dueAmount: "1.2 MB",
        payableAmount: "James Carter",
    },
    {
        sl: "3",
        date: "18 Feb 2026",
        paymentType: "Maria's Editing — Receipt",
        paidAmount: "Receipt",
        dueAmount: "890 KB",
        payableAmount: "Sarah Mitchell",
    },
    {
        sl: "4",
        date: "05 Mar 2026",
        paymentType: "Housing Stability — Compliance Report",
        paidAmount: "Report",
        dueAmount: "3.4 MB",
        payableAmount: "James Carter",
    },
    {
        sl: "5",
        date: "12 Mar 2026",
        paymentType: "Tax Form 1099 — Writing Coach LLC",
        paidAmount: "Tax Form",
        dueAmount: "156 KB",
        payableAmount: "Sarah Mitchell",
    },
];


const InventoryRecentTransactionsTable = () => {
    return (
        <Table className="table-auto border-spacing-0 border-separate">
            <TableHeader>
                <TableRow className="border-0">
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600 text-start rounded-tl-lg">
                        SL
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600 text-center">
                        Date Uploaded
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600 text-center">
                        Document Name
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600 text-center">
                        Type
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600 text-center text-center rounded-tr-lg">
                        File Size
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600 text-center text-center rounded-tr-lg">
                        Uploaded By
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {recentTransactionContents.map((coursesContent, index) => {
                    const isLast = index === recentTransactionContents.length - 1;
                    return (
                        <TableRow key={index}>
                            <TableCell
                                className={`py-4 px-4 first:border-s last:border-e font-medium text-neutral-500 dark:text-neutral-200 border-b border-neutral-200 dark:border-slate-600 text-start ${isLast ? "rounded-bl-lg" : ""
                                    }`}
                            >
                                {coursesContent.sl}
                            </TableCell>
                            <TableCell
                                className={`py-4 px-4 first:border-s last:border-e font-medium text-neutral-500 dark:text-neutral-200 border-b border-neutral-200 dark:border-slate-600 text-center ${isLast ? "" : ""
                                    }`}
                            >
                                {coursesContent.date}
                            </TableCell>
                            <TableCell
                                className={`py-4 px-4 first:border-s last:border-e font-medium text-neutral-500 dark:text-neutral-200 border-b border-neutral-200 dark:border-slate-600 text-center ${isLast ? "" : ""
                                    }`}
                            >
                                <div className="text-neutral-600 dark:text-neutral-100">
                                    {coursesContent.paymentType}
                                </div>
                            </TableCell>
                            <TableCell
                                className={`py-4 px-4 first:border-s last:border-e font-medium text-neutral-500 dark:text-neutral-200 border-b border-neutral-200 dark:border-slate-600 text-center ${isLast ? "" : ""
                                    }`}
                            >
                                {coursesContent.paidAmount}
                            </TableCell>
                            <TableCell
                                className={`py-4 px-4 first:border-s last:border-e font-medium text-neutral-500 dark:text-neutral-200 border-b border-neutral-200 dark:border-slate-600 text-center ${isLast ? "" : ""
                                    }`}
                            >
                                {coursesContent.dueAmount}
                            </TableCell>

                            <TableCell
                                className={`py-4 px-4 first:border-s last:border-e font-medium text-neutral-500 dark:text-neutral-200 border-b border-neutral-200 dark:border-slate-600 text-center ${isLast ? "rounded-br-lg" : ""
                                    }`}
                            >
                                {coursesContent.payableAmount}
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
};

export default InventoryRecentTransactionsTable;
