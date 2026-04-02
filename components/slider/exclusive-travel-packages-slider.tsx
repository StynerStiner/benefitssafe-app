import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";
import { Briefcase, Monitor, Package, Home, HeartPulse, User, LucideIcon, DollarSign } from "lucide-react";

interface ExclusiveTravelPackagesSliders {
    id: number;
    icon: LucideIcon;
    iconBg: string;
    title: string;
    duration: string;
    price: string;
    user: string;
}

interface Grant {
    id: string;
    name: string;
    totalAmount: string;
    spentAmount: string;
    status: string;
}

const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-500",
    DRAFT: "bg-purple-500",
    COMPLETED: "bg-blue-500",
    SUSPENDED: "bg-yellow-500",
    ARCHIVED: "bg-neutral-500",
};

const statusIcons: Record<string, LucideIcon> = {
    ACTIVE: Briefcase,
    DRAFT: Monitor,
    COMPLETED: Package,
    SUSPENDED: Home,
    ARCHIVED: HeartPulse,
};

export const exclusiveTravelPackagesSliderData: ExclusiveTravelPackagesSliders[] = [
    {
        id: 1,
        icon: Briefcase,
        iconBg: "bg-blue-500",
        title: "Professional Services",
        duration: "Direct vendor payment",
        price: "Allowed",
        user: "5 grants",
    },
    {
        id: 2,
        icon: Monitor,
        iconBg: "bg-purple-500",
        title: "Software & Subscriptions",
        duration: "Recurring billing",
        price: "Allowed",
        user: "5 grants",
    },
    {
        id: 3,
        icon: Package,
        iconBg: "bg-teal-500",
        title: "Materials & Equipment",
        duration: "One-time purchase",
        price: "Allowed",
        user: "4 grants",
    },
    {
        id: 4,
        icon: Home,
        iconBg: "bg-yellow-500",
        title: "Housing & Shelter",
        duration: "Requires review",
        price: "Review Required",
        user: "2 grants",
    },
    {
        id: 5,
        icon: HeartPulse,
        iconBg: "bg-red-500",
        title: "Medical & Health",
        duration: "Requires review",
        price: "Review Required",
        user: "1 grant",
    },
];

function ExclusiveTravelPackagesSlider({ grants }: { grants?: Grant[] }) {
    // If grants are provided, build slider data from real grants
    const sliderData: ExclusiveTravelPackagesSliders[] = (grants && grants.length > 0)
        ? grants.map((grant, index) => {
            const total = parseFloat(grant.totalAmount || "0");
            const spent = parseFloat(grant.spentAmount || "0");
            const remaining = total - spent;
            const IconComponent = statusIcons[grant.status] || DollarSign;
            const iconBg = statusColors[grant.status] || "bg-blue-500";
            return {
                id: index + 1,
                icon: IconComponent,
                iconBg,
                title: grant.name,
                duration: `$${remaining.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} remaining`,
                price: `$${total.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                user: grant.status,
            };
        })
        : exclusiveTravelPackagesSliderData;

    return (
        <Carousel className="w-full"
            opts={{
                align: "start",
                loop: true,
            }}
        >

            <div className="flex items-center justify-between mb-4">
                <h6 className="text-lg mb-0">Expense Category Rules</h6>
                <div className="flex items-center gap-4">
                    <CarouselPrevious className="flex items-center rounded-full border border-neutral-400 text-neutral-600 dark:text-neutral-300 bg-white hover:bg-blue-600 hover:text-white justify-center active:scale-90 w-10 h-10 relative right-0 left-0 translate-y-0" />
                    <CarouselNext className="flex items-center rounded-full border border-neutral-400 text-neutral-600 dark:text-neutral-300 bg-white hover:bg-blue-600 hover:text-white justify-center active:scale-90 w-10 h-10 relative right-0 left-0 translate-y-0" />
                </div>
            </div>

            <CarouselContent>
                {sliderData.map((card) => (
                    <CarouselItem key={card.id} className="basis-1/2 lg:basis-1/2 xl:basis-1/3 2xl:basis-1/4">
                        <div className="bg-white dark:bg-[#273142] p-1.5 rounded-xl">
                            <div className={`rounded-lg overflow-hidden ${card.iconBg} flex items-center justify-center h-[120px]`}>
                                <card.icon className="w-12 h-12 text-white" />
                            </div>
                            <div className="p-2 pt-4">
                                <h6 className="text-md mb-1">{card.title}</h6>
                                <span className="text-neutral-600 dark:text-neutral-300">{card.duration}</span>
                                <div className="mt-2.5 flex items-center justify-between gap-10">
                                    <span className="font-semibold text-neutral-600 dark:text-neutral-300 text-sm">{card.price}</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-blue-600 line-height-1 text-md font-medium">
                                            <User className="w-4" />
                                        </span>
                                        <span className="text-sm font-medium">({card.user})</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CarouselItem>
                ))}
            </CarouselContent>
        </Carousel >
    );
}

export default ExclusiveTravelPackagesSlider;