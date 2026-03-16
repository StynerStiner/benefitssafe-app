import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import Image, { StaticImageData } from "next/image";

import User1 from "@/public/assets/images/users/user1.png";
import User2 from "@/public/assets/images/users/user2.png";
import User3 from "@/public/assets/images/users/user3.png";
import User4 from "@/public/assets/images/users/user4.png";
import User5 from "@/public/assets/images/users/user5.png";

interface ActivityStatus {
    label: string;
    type: "success" | "warning" | "danger" | "info";
}

interface RecentActivityItem {
    user: {
        name: string;
        email: string;
        image: StaticImageData;
    };
    transactionId: string;
    amount: string;
    payment: string;
    date: string;
    status: ActivityStatus;
}

const RecentActivityTableSassContents: RecentActivityItem[] = [
    {
        user: {
            name: "Cameron Williamson",
            email: "osgoodwy@gmail.com",
            image: User1,
        },
        transactionId: "9562415412263",
        amount: "$29.00",
        payment: "Bank",
        date: "24 Jun 2024",
        status: { label: "Paid", type: "success" },
    },
    {
        user: {
            name: "Jenny Wilson",
            email: "jennywilson@mail.com",
            image: User2,
        },
        transactionId: "8745963214785",
        amount: "$120.50",
        payment: "PayPal",
        date: "05 Jul 2024",
        status: { label: "Pending", type: "warning" },
    },
    {
        user: {
            name: "Courtney Henry",
            email: "courtneyh@mail.com",
            image: User3,
        },
        transactionId: "6321457896521",
        amount: "$75.99",
        payment: "Credit Card",
        date: "18 Jul 2024",
        status: { label: "Failed", type: "danger" },
    },
    {
        user: {
            name: "Darrell Steward",
            email: "darrells@mail.com",
            image: User4,
        },
        transactionId: "4578963258741",
        amount: "$210.00",
        payment: "Stripe",
        date: "30 Jul 2024",
        status: { label: "In Progress", type: "info" },
    },
    {
        user: {
            name: "Kathryn Murphy",
            email: "kathrynm@mail.com",
            image: User5,
        },
        transactionId: "7896541239874",
        amount: "$340.75",
        payment: "Bank Transfer",
        date: "12 Aug 2024",
        status: { label: "Paid", type: "success" },
    },
];

const RecentActivityTableSass = () => {
    return (
        <Table className="table-auto border-spacing-0 border-separate">
            <TableHeader>
                <TableRow>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-12 text-start">
                        Users
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-12 text-center">
                        Transaction ID
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-12 text-center">
                        Amount
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-12 text-center">
                        Payment
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-12 text-center">
                        Date
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-12 text-center">
                        Status
                    </TableHead>
                </TableRow>
            </TableHeader>

            <TableBody>
                {RecentActivityTableSassContents.map((item, index) => (
                    <TableRow key={index}>
                        {/* User */}
                        <TableCell className="py-3.5 px-6 text-start">
                            <div className="flex items-center">
                                <Image
                                    src={item.user.image}
                                    alt={item.user.name}
                                    width={40}
                                    height={40}
                                    className="w-10 h-10 rounded-full me-3"
                                />
                                <div>
                                    <h6 className="text-base mb-0">{item.user.name}</h6>
                                    <span className="text-sm text-neutral-600 dark:text-neutral-200 font-medium">
                                        {item.user.email}
                                    </span>
                                </div>
                            </div>
                        </TableCell>

                        <TableCell className="py-3.5 px-6 text-center">
                            {item.transactionId}
                        </TableCell>

                        <TableCell className="py-3.5 px-6 text-center">
                            {item.amount}
                        </TableCell>

                        <TableCell className="py-3.5 px-6 text-center">
                            {item.payment}
                        </TableCell>

                        <TableCell className="py-3.5 px-6 text-center">
                            {item.date}
                        </TableCell>

                        <TableCell className="py-3.5 px-6 text-center">
                            <span
                                className={`px-8 py-1 rounded-[50rem] font-medium text-sm
                                    ${item.status.type === "success" && "bg-green-500/20 text-green-600 dark:text-green-400"}
                                    ${item.status.type === "warning" && "bg-yellow-500/20 text-yellow-400"}
                                    ${item.status.type === "danger" && "bg-red-500/20 text-red-600 dark:text-red-400"}
                                    ${item.status.type === "info" && "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400"}
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

export default RecentActivityTableSass;
