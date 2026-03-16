import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import UserGridImage1 from "@/public/assets/images/home-twelve/transaction-img1.png";
import UserGridImage2 from "@/public/assets/images/home-twelve/transaction-img2.png";
import UserGridImage3 from "@/public/assets/images/home-twelve/transaction-img3.png";
import UserGridImage4 from "@/public/assets/images/home-twelve/transaction-img4.png";
import UserGridImage5 from "@/public/assets/images/home-twelve/transaction-img5.png";
import Image, { StaticImageData } from "next/image";

interface ActivityStatus {
    label: string;
    type: "success" | "warning" | "purple";
}

interface PerformanceAgentsTableTypeItem {
    customer: {
        name: string;
        image: string | StaticImageData;
    };
    id: string;
    totalTicket: string;
    openTicket: string;
    resolvedTicket: string;
    progressBg: string;
    stock: string;
}

const PerformanceAgentsTableTableContents: PerformanceAgentsTableTypeItem[] = [
    {
        customer: {
            name: "Dianne Russell",
            image: UserGridImage1,
        },
        id: "#63254",
        totalTicket: "300",
        openTicket: "250",
        resolvedTicket: "50",
        progressBg: "bg-red-600",
        stock: "30%",
    },
    {
        customer: {
            name: "Wade Warren",
            image: UserGridImage2,
        },
        id: "#63254",
        totalTicket: "300",
        openTicket: "250",
        resolvedTicket: "50",
        progressBg: "bg-yellow-600",
        stock: "50%",
    },
    {
        customer: {
            name: "Albert Flores",
            image: UserGridImage3,
        },
        id: "#63254",
        totalTicket: "300",
        openTicket: "250",
        resolvedTicket: "50",
        progressBg: "bg-cyan-600",
        stock: "60%",
    },
    {
        customer: {
            name: "Bessie Cooper",
            image: UserGridImage4,
        },
        id: "#63254",
        totalTicket: "300",
        openTicket: "250",
        resolvedTicket: "50",
        progressBg: "bg-green-600",
        stock: "80%",
    },
    {
        customer: {
            name: "Arlene McCoy",
            image: UserGridImage5,
        },
        id: "#63254",
        totalTicket: "300",
        openTicket: "250",
        resolvedTicket: "50",
        progressBg: "bg-primary",
        stock: "70%",
    },
];

const PerformanceAgentsTable = () => {
    return (
        <Table className="table-auto border-spacing-0 border-separate">
            <TableHeader>
                <TableRow>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-start">
                        Agent Name
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        ID Number
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Total Tickets
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Open Tickets
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Resolved Ticket
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-start">
                        Satisfaction Rate
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {PerformanceAgentsTableTableContents.map((item, index) => (
                    <TableRow key={index}>
                        {/* Customer */}
                        <TableCell className="py-3.5 px-6 text-start">
                            <div className="flex items-center">
                                <Image
                                    src={item.customer.image}
                                    alt={item.customer.name}
                                    width={40}
                                    height={40}
                                    className="w-10 h-10 rounded-md me-3"
                                />
                                <div>
                                    <h6 className="text-base !font-medium mb-0">{item.customer.name}</h6>
                                </div>
                            </div>
                        </TableCell>

                        {/* ID */}
                        <TableCell className="py-3.5 px-6 text-center">{item.id}</TableCell>

                        {/* totalTicket */}
                        <TableCell className="py-3.5 px-6 text-center">{item.totalTicket}</TableCell>

                        {/* Amount */}
                        <TableCell className="py-3.5 px-6 text-center">{item.openTicket}</TableCell>

                        {/* date */}
                        <TableCell className="py-3.5 px-6 text-center">{item.resolvedTicket}</TableCell>

                        {/* Status */}
                        <TableCell
                            className={`py-3.5 px-6 text-start}`}
                        >
                            <div className="mx-auto space-y-1">
                                <div className="w-full">
                                    <div className="rounded-full h-2 bg-gray-200 dark:bg-neutral-700">
                                        <div
                                            className={`${item.progressBg} h-2 rounded-full`}
                                            style={{ width: `${item.stock}` }}
                                        ></div>
                                    </div>
                                </div>
                                <span className="mt-.5 inline-block">{item.stock}</span>
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

export default PerformanceAgentsTable;
