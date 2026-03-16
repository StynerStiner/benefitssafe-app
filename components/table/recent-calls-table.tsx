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
    type: "resolved" | "dropped" | "pending" | "danger" | "info";
}

interface RecentCallsTableTypeItem {
    customer: {
        name: string;
        image: string | StaticImageData;
    };
    type: string;
    duration: string;
    time: string;
    status: ActivityStatus;
}

const RecentCallsTableContents: RecentCallsTableTypeItem[] = [
    {
        customer: {
            name: "Sarah Mitchell",
            image: UserGridImage1,
        },
        type: "Approved",
        duration: "expense",
        time: "Mar 6",
        status: { label: "Completed", type: "resolved" },
    },
    {
        customer: {
            name: "James Carter",
            image: UserGridImage2,
        },
        type: "Created",
        duration: "expense",
        time: "Jan 15",
        status: { label: "Completed", type: "resolved" },
    },
    {
        customer: {
            name: "Sarah Mitchell",
            image: UserGridImage3,
        },
        type: "Created",
        duration: "card",
        time: "Jan 10",
        status: { label: "Completed", type: "resolved" },
    },
    {
        customer: {
            name: "James Carter",
            image: UserGridImage4,
        },
        type: "Created",
        duration: "expense",
        time: "Jan 7",
        status: { label: "Completed", type: "resolved" },
    },
    {
        customer: {
            name: "Sarah Mitchell",
            image: UserGridImage5,
        },
        type: "Approved",
        duration: "vendor",
        time: "Jan 5",
        status: { label: "Completed", type: "resolved" },
    },
    {
        customer: {
            name: "Sarah Mitchell",
            image: UserGridImage3,
        },
        type: "Approved",
        duration: "expense",
        time: "Dec 28",
        status: { label: "Completed", type: "resolved" },
    },
];


const RecentCallsTable = () => {
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
                {RecentCallsTableContents.map((item, index) => {
                    const isLast = index === RecentCallsTableContents.length - 1;

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
