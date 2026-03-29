import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Edit, Eye, Trash2 } from "lucide-react";

interface Vendor {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    type: string;
    status: string;
    createdAt: string;
}

const typeLabels: Record<string, string> = {
    SAAS_SUBSCRIPTION: "SaaS",
    SERVICE_PROVIDER: "Service Provider",
    ONE_TIME_VENDOR: "One-Time",
};

const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-600/15 text-green-600 border-green-600",
    APPROVED: "bg-green-600/15 text-green-600 border-green-600",
    PENDING: "bg-yellow-600/15 text-yellow-600 border-yellow-600",
    SUSPENDED: "bg-yellow-600/15 text-yellow-600 border-yellow-600",
    AWAITING_PAYMENT_SETUP: "bg-yellow-600/15 text-yellow-600 border-yellow-600",
    REJECTED: "bg-red-600/15 text-red-600 border-red-600",
    BLOCKED: "bg-red-600/15 text-red-600 border-red-600",
    ARCHIVED: "bg-gray-600/15 text-gray-600 dark:text-white border-gray-400",
    DRAFT: "bg-gray-600/15 text-gray-600 dark:text-white border-gray-400",
};

interface UserTableProps {
    vendors?: Vendor[];
    onView?: (vendor: Vendor) => void;
    onEdit?: (vendor: Vendor) => void;
    onDelete?: (vendor: Vendor) => void;
}

export default function UserTable({ vendors, onView, onEdit, onDelete }: UserTableProps) {
    const list = vendors || [];

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="px-4 h-12 text-center bg-neutral-100 dark:bg-slate-700 border-t border-neutral-200 first:border-s last:border-e dark:border-slate-600 rounded-tl-lg w-[80px]">S.L</TableHead>
                    <TableHead className="px-4 h-12 text-center bg-neutral-100 dark:bg-slate-700 border-t border-neutral-200 first:border-s last:border-e dark:border-slate-600 ">Added</TableHead>
                    <TableHead className="px-4 h-12 text-start bg-neutral-100 dark:bg-slate-700 border-t border-neutral-200 first:border-s last:border-e dark:border-slate-600 ">Vendor Name</TableHead>
                    <TableHead className="px-4 h-12 text-center bg-neutral-100 dark:bg-slate-700 border-t border-neutral-200 first:border-s last:border-e dark:border-slate-600 ">Email</TableHead>
                    <TableHead className="px-4 h-12 text-center bg-neutral-100 dark:bg-slate-700 border-t border-neutral-200 first:border-s last:border-e dark:border-slate-600 ">Type</TableHead>
                    <TableHead className="px-4 h-12 text-center bg-neutral-100 dark:bg-slate-700 border-t border-neutral-200 first:border-s last:border-e dark:border-slate-600 ">Phone</TableHead>
                    <TableHead className="px-4 h-12 text-center bg-neutral-100 dark:bg-slate-700 border-t border-neutral-200 first:border-s last:border-e dark:border-slate-600 text-center">Status</TableHead>
                    <TableHead className="px-4 h-12 text-center bg-neutral-100 dark:bg-slate-700 border-t border-neutral-200 first:border-s last:border-e dark:border-slate-600 text-center rounded-tr-lg">Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {list.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-neutral-500 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600">
                            No vendors found
                        </TableCell>
                    </TableRow>
                ) : (
                    list.map((vendor, index) => {
                        const isLast = index === list.length - 1;
                        const initials = vendor.name.split(" ").map(w => w[0] || "").join("").slice(0, 2).toUpperCase();
                        return (
                            <TableRow key={vendor.id}>
                                <TableCell
                                    className={`py-4 px-4 border-b text-center first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""
                                        }`}
                                >{String(index + 1).padStart(2, "0")}</TableCell>
                                <TableCell
                                    className={`py-4 px-4 border-b text-center first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""
                                        }`}
                                >{formatDate(vendor.createdAt)}</TableCell>
                                <TableCell
                                    className={`py-4 px-4 border-b text-center first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-slate-600 flex items-center justify-center text-sm font-semibold shrink-0">
                                            {initials}
                                        </span>
                                        <span>{vendor.name}</span>
                                    </div>
                                </TableCell>
                                <TableCell
                                    className={`py-4 px-4 border-b text-center first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""
                                        }`}
                                >{vendor.email || "-"}</TableCell>
                                <TableCell
                                    className={`py-4 px-4 border-b text-center first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""
                                        }`}
                                >
                                    <span className="px-3 py-1.5 rounded text-sm font-medium border bg-blue-600/15 text-blue-600 border-blue-600">
                                        {typeLabels[vendor.type] || vendor.type}
                                    </span>
                                </TableCell>
                                <TableCell
                                    className={`py-4 px-4 border-b text-center first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""
                                        }`}
                                >{vendor.phone || "-"}</TableCell>
                                <TableCell
                                    className={`py-4 px-4 border-b text-center first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""
                                        }`}
                                >
                                    <span
                                        className={`px-3 py-1.5 rounded text-sm font-medium border ${statusColors[vendor.status] || "bg-gray-600/15 text-gray-600 dark:text-white border-gray-400"
                                            }`}
                                    >
                                        {vendor.status}
                                    </span>
                                </TableCell>
                                <TableCell
                                    className={`py-4 px-4 border-b text-center first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""
                                        }`}
                                >
                                    <div className="flex justify-center gap-2">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="rounded-[50%] text-blue-500 bg-primary/10"
                                            onClick={() => onView ? onView(vendor) : alert(`View vendor: ${vendor.name}`)}
                                        >
                                            <Eye className="w-5 h-5" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="rounded-[50%] text-green-600 bg-green-600/10"
                                            onClick={() => onEdit ? onEdit(vendor) : alert(`Edit vendor: ${vendor.name}`)}
                                        >
                                            <Edit className="w-5 h-5" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="rounded-[50%] text-red-500 bg-red-500/10"
                                            onClick={() => onDelete ? onDelete(vendor) : alert(`Delete vendor: ${vendor.name}`)}
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )
                    })
                )}
            </TableBody>
        </Table>
    );
}
