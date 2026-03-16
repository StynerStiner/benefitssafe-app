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

interface BestAgentsCardTableTypeItem {
    customer: {
        name: string;
        image: string | StaticImageData;
    };
    amounts: string;
    startDate: string;
    endDate: string;
    duration: string;
}

const BestAgentsCardTableContents: BestAgentsCardTableTypeItem[] = [
    {
        customer: {
            name: "Tokyo Tower",
            image: UserGridImage1,
        },
        amounts: "380",
        startDate: "8 mins 10 secs",
        endDate: "70%",
        duration: "90%",
    },
    {
        customer: {
            name: "Santorini Resort",
            image: UserGridImage2,
        },
        amounts: "65",
        startDate: "4 mins 16 secs",
        endDate: "80%",
        duration: "85%",
    },
    {
        customer: {
            name: "Bali Beach Villa",
            image: UserGridImage3,
        },
        amounts: "280",
        startDate: "5 mins 30 secs",
        endDate: "90%",
        duration: "80%",
    },
    {
        customer: {
            name: "Swiss Alps Hotel",
            image: UserGridImage4,
        },
        amounts: "380",
        startDate: "12 mins 45 secs",
        endDate: "95%",
        duration: "75%",
    },
    {
        customer: {
            name: "Maldives Retreat",
            image: UserGridImage5,
        },
        amounts: "150",
        startDate: "3 mins 45 secs",
        endDate: "95%",
        duration: "40%",
    }
];


const BestAgentsCardTable = () => {
    return (
        <Table className="table-auto border-spacing-0 border-separate">
            <TableHeader>
                <TableRow>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-start">
                        User
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Calls
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Avg. Duration
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        FCR
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Duration
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {BestAgentsCardTableContents.map((item, index) => {
                    const isLast = index === BestAgentsCardTableContents.length - 1;

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
                        </TableRow>
                    )
                })}
            </TableBody>
        </Table>
    );
};

export default BestAgentsCardTable;
