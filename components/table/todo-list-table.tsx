import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import todoListImage1 from "@/public/assets/images/homeThirteen/todo-list-img1.png";
import todoListImage2 from "@/public/assets/images/homeThirteen/todo-list-img2.png";
import todoListImage3 from "@/public/assets/images/homeThirteen/todo-list-img3.png";
import todoListImage4 from "@/public/assets/images/homeThirteen/todo-list-img4.png";
import { Checkbox } from "@radix-ui/react-checkbox";
import Image, { StaticImageData } from "next/image";

interface ActivityStatus {
    label: string;
    type: "success" | "warning" | "purple";
}

interface todoListTypeItem {
    id: string;
    duration: string;
    amount: StaticImageData;
    date: string;
    priority: string;
    status: ActivityStatus;
}

const todoListTableContents: todoListTypeItem[] = [
    {
        id: "#63254",
        duration: "Mobile app Development",
        amount: todoListImage1,
        date: "Feb 10, 2025",
        priority: "High",
        status: { label: "Completed", type: "success" },
    },
    {
        id: "#63254",
        duration: "Product design",
        amount: todoListImage2,
        date: "Feb 10, 2025",
        priority: "Low",
        status: { label: "Pending", type: "warning" },
    },
    {
        id: "#63254",
        duration: "UI/UX Design",
        amount: todoListImage3,
        date: "Feb 10, 2025",
        priority: "Medium",
        status: { label: "Completed", type: "success" },
    },
    {
        id: "#63254",
        duration: "Website ui design",
        amount: todoListImage4,
        date: "Feb 10, 2025",
        priority: "High",
        status: { label: "Pending", type: "warning" },
    },
    {
        id: "#63254",
        duration: "PHP Project",
        amount: todoListImage1,
        date: "Feb 10, 2025",
        priority: "Low",
        status: { label: "Completed", type: "success" },
    },
];

const TodoListTable = () => {
    return (
        <Table className="table-auto border-spacing-0 border-separate">
            <TableHeader>
                <TableRow>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-start">
                        <Checkbox
                            className="border border-neutral-500 w-4 h-4"
                        />
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        ID
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Task Name
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Assigned To
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Due Date
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Priority
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Status
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {todoListTableContents.map((item, index) => (
                    <TableRow key={index}>
                        {/* Customer */}
                        <TableCell className="py-3.5 px-6 text-start">
                            <div className="">
                                <Checkbox
                                    className="border border-neutral-500 w-4 h-4"
                                />
                            </div>
                        </TableCell>

                        {/* ID */}
                        <TableCell className="py-3.5 px-6 text-center text-neutral-600 dark:text-neutral-200">{item.id}</TableCell>

                        {/* duration */}
                        <TableCell className="py-3.5 px-6 text-center text-neutral-600 dark:text-neutral-200">{item.duration}</TableCell>

                        {/* Amount */}
                        <TableCell className="py-3.5 px-6 text-center text-neutral-600 dark:text-neutral-200">
                            <div className="flex items-center justify-center">
                                <Image src={item.amount} alt="Assigned To Image" />
                            </div>
                        </TableCell>

                        {/* date */}
                        <TableCell className="py-3.5 px-6 text-center text-neutral-600 dark:text-neutral-200">{item.date}</TableCell>

                        <TableCell className="py-3.5 px-6 text-center text-neutral-600 dark:text-neutral-200">{item.priority}</TableCell>

                        {/* Status */}
                        <TableCell className="py-3.5 px-6 text-center text-neutral-600 dark:text-neutral-200">
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

export default TodoListTable;
