import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import UserGridImage1 from "@/public/assets/images/user-grid/user-grid-img1.png";
import UserGridImage2 from "@/public/assets/images/user-grid/user-grid-img2.png";
import UserGridImage3 from "@/public/assets/images/user-grid/user-grid-img3.png";
import UserGridImage4 from "@/public/assets/images/user-grid/user-grid-img4.png";
import UserGridImage5 from "@/public/assets/images/user-grid/user-grid-img5.png";
import Image, { StaticImageData } from "next/image";

interface ActivityStatus {
    label: string;
    type: "success" | "warning" | "purple" | "danger" | "info";
}

interface RecentPurposePlanTableTypeItem {
    customer: {
        name: string;
        image: string | StaticImageData; // ✅ allow both
    };
    amounts: string;
    startDate: string;
    endDate: string;
    duration: string;
    status: ActivityStatus;
}

const RecentPurposePlanTableContents: RecentPurposePlanTableTypeItem[] = [
    {
        customer: {
            name: "Tokyo Tower",
            image: UserGridImage1,
        },
        amounts: "$49.00",
        startDate: "10 min ago",
        endDate: "Feb 15, 2025",
        duration: "2 Months",
        status: { label: "Completed", type: "success" },
    },
    {
        customer: {
            name: "Santorini Resort",
            image: UserGridImage2,
        },
        amounts: "$65.00",
        startDate: "1 hour ago",
        endDate: "Mar 10, 2025",
        duration: "3 Months",
        status: { label: "Pending", type: "warning" },
    },
    {
        customer: {
            name: "Bali Beach Villa",
            image: UserGridImage3,
        },
        amounts: "$99.00",
        startDate: "2 hours ago",
        endDate: "Apr 1, 2025",
        duration: "6 Months",
        status: { label: "Completed", type: "success" },
    },
    {
        customer: {
            name: "Swiss Alps Hotel",
            image: UserGridImage4,
        },
        amounts: "$120.00",
        startDate: "1 day ago",
        endDate: "May 20, 2025",
        duration: "1 Year",
        status: { label: "Cancelled", type: "danger" },
    },
    {
        customer: {
            name: "Maldives Retreat",
            image: UserGridImage5,
        },
        amounts: "$89.00",
        startDate: "3 days ago",
        endDate: "Jun 5, 2025",
        duration: "4 Months",
        status: { label: "In Progress", type: "info" },
    },
    {
        customer: {
            name: "Bali Beach Villa",
            image: UserGridImage3,
        },
        amounts: "$99.00",
        startDate: "2 hours ago",
        endDate: "Apr 1, 2025",
        duration: "6 Months",
        status: { label: "Completed", type: "success" },
    },
];


const RecentPurposePlanTable = () => {
    return (
        <Table className="table-auto border-spacing-0 border-separate">
            <TableHeader>
                <TableRow>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-start">
                        User
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Amount
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Start Date
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        End Date
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Duration
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Status
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {RecentPurposePlanTableContents.map((item, index) => {
                    const isLast = index === RecentPurposePlanTableContents.length - 1;

                    return (
                        <TableRow key={index}>
                            {/* Customer */}
                            <TableCell className={` ${isLast ? "border-0" : "border-b border-neutral-200"} dark:border-neutral-600 py-3.5 px-6 text-start`}>
                                <div className="flex items-center">
                                    <Image
                                        src={item.customer.image}
                                        alt={item.customer.name}
                                        width={40}
                                        height={40}
                                        className="w-10 h-10 rounded-md me-3"
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

                            {/* Status */}
                            <TableCell className={` ${isLast ? "border-0" : "border-b border-neutral-200"} dark:border-neutral-600 py-3.5 px-6 text-center`}>
                                <span
                                    className={`px-4 py-1.5 rounded-md font-medium text-sm
                                    ${item.status.type === "success" && "bg-green-500/15 text-green-600 dark:text-green-600"}
                                    ${item.status.type === "warning" && "bg-yellow-500/15 text-yellow-600 dark:text-yellow-600"}
                                    ${item.status.type === "purple" && "bg-purple-500/15 text-purple-600 dark:text-purple-600"}
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

export default RecentPurposePlanTable;
