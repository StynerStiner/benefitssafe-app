import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { ChevronRight, EllipsisVertical } from "lucide-react";
import Image, { StaticImageData } from "next/image";

import UserGridBg1 from "@/public/assets/images/user-grid/user-grid-bg1.png";
import UserGridBg10 from "@/public/assets/images/user-grid/user-grid-bg10.png";
import UserGridBg11 from "@/public/assets/images/user-grid/user-grid-bg11.png";
import UserGridBg12 from "@/public/assets/images/user-grid/user-grid-bg12.png";
import UserGridBg2 from "@/public/assets/images/user-grid/user-grid-bg2.png";
import UserGridBg3 from "@/public/assets/images/user-grid/user-grid-bg3.png";
import UserGridBg4 from "@/public/assets/images/user-grid/user-grid-bg4.png";
import UserGridBg5 from "@/public/assets/images/user-grid/user-grid-bg5.png";
import UserGridBg6 from "@/public/assets/images/user-grid/user-grid-bg6.png";
import UserGridBg7 from "@/public/assets/images/user-grid/user-grid-bg7.png";
import UserGridBg8 from "@/public/assets/images/user-grid/user-grid-bg8.png";
import UserGridBg9 from "@/public/assets/images/user-grid/user-grid-bg9.png";

import UserGridImg1 from "@/public/assets/images/user-grid/user-grid-img1.png";
import UserGridImg2 from "@/public/assets/images/user-grid/user-grid-img2.png";
import UserGridImg3 from "@/public/assets/images/user-grid/user-grid-img3.png";
import UserGridImg4 from "@/public/assets/images/user-grid/user-grid-img4.png";
import UserGridImg5 from "@/public/assets/images/user-grid/user-grid-img5.png";
import UserGridImg6 from "@/public/assets/images/user-grid/user-grid-img6.png";
import UserGridImg7 from "@/public/assets/images/user-grid/user-grid-img7.png";
import UserGridImg8 from "@/public/assets/images/user-grid/user-grid-img8.png";
import UserGridImg9 from "@/public/assets/images/user-grid/user-grid-img9.png";
import UserGridImg10 from "@/public/assets/images/user-grid/user-grid-img10.png";
import UserGridImg11 from "@/public/assets/images/user-grid/user-grid-img11.png";
import UserGridImg12 from "@/public/assets/images/user-grid/user-grid-img12.png";

// --- CHANGED: Interface for API user data ---
interface TeamUser {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    avatarUrl: string | null;
    isActive: boolean;
}

// --- Template's original bg/avatar image pools for cycling ---
const bgImages: StaticImageData[] = [UserGridBg1, UserGridBg2, UserGridBg3, UserGridBg4, UserGridBg5, UserGridBg6, UserGridBg7, UserGridBg8, UserGridBg9, UserGridBg10, UserGridBg11, UserGridBg12];
const avatarImages: StaticImageData[] = [UserGridImg1, UserGridImg2, UserGridImg3, UserGridImg4, UserGridImg5, UserGridImg6, UserGridImg7, UserGridImg8, UserGridImg9, UserGridImg10, UserGridImg11, UserGridImg12];

const roleLabels: Record<string, string> = {
    nonprofit_admin: "Admin",
    nonprofit_staff: "Staff",
    beneficiary: "Beneficiary",
    cpa: "CPA",
    auditor: "Auditor",
    attorney: "Attorney",
    grant_officer: "Grant Officer",
    vendor: "Vendor",
    platform_admin: "Platform Admin",
    support_agent: "Support",
    compliance_officer: "Compliance",
    billing_admin: "Billing",
};

// Template demo data as fallback when no real users
const demoUsers: TeamUser[] = [
    { id: "d1", firstName: "Jacob", lastName: "Jones", email: "jacob.jones@example.com", role: "nonprofit_admin", avatarUrl: null, isActive: true },
    { id: "d2", firstName: "Darrell", lastName: "Steward", email: "darrell.steward@example.com", role: "nonprofit_staff", avatarUrl: null, isActive: true },
    { id: "d3", firstName: "Jerome", lastName: "Bell", email: "jerome.bell@example.com", role: "cpa", avatarUrl: null, isActive: true },
    { id: "d4", firstName: "Marvin", lastName: "McKinney", email: "marvin.mckinney@example.com", role: "beneficiary", avatarUrl: null, isActive: true },
    { id: "d5", firstName: "Kristin", lastName: "Watson", email: "kristin.watson@example.com", role: "nonprofit_staff", avatarUrl: null, isActive: false },
    { id: "d6", firstName: "Courtney", lastName: "Henry", email: "courtney.henry@example.com", role: "vendor", avatarUrl: null, isActive: true },
    { id: "d7", firstName: "Ronald", lastName: "Richards", email: "ronald.richards@example.com", role: "cpa", avatarUrl: null, isActive: true },
    { id: "d8", firstName: "Kathryn", lastName: "Murphy", email: "kathryn.murphy@example.com", role: "nonprofit_admin", avatarUrl: null, isActive: true },
    { id: "d9", firstName: "Cody", lastName: "Fisher", email: "cody.fisher@example.com", role: "auditor", avatarUrl: null, isActive: true },
    { id: "d10", firstName: "Annette", lastName: "Black", email: "annette.black@example.com", role: "attorney", avatarUrl: null, isActive: true },
    { id: "d11", firstName: "Eleanor", lastName: "Pena", email: "eleanor.pena@example.com", role: "nonprofit_staff", avatarUrl: null, isActive: true },
    { id: "d12", firstName: "Guy", lastName: "Hawkins", email: "guy.hawkins@example.com", role: "grant_officer", avatarUrl: null, isActive: false },
];

const UsersGridCard = ({ users }: { users?: TeamUser[] }) => {
    const list = (users && users.length > 0) ? users : demoUsers;

    return (
        list.map((userItem, index) => {
            return (
                <div className="user-grid-card" key={userItem.id}>
                    <div className="relative border border-neutral-200 dark:border-neutral-600 rounded-2xl overflow-hidden">
                        <div className="relative h-[127px]">
                            <Image src={bgImages[index % bgImages.length]} alt="Image" fill className="w-full object-fit-cover" />

                        </div>

                        <div className="dropdown absolute top-0 end-0 me-4 mt-4">
                            <DropdownMenu>
                                <DropdownMenuTrigger className='bg-gradient-to-r from-white/50 w-8 h-8 rounded-lg border border-light-white flex justify-center items-center text-white'>
                                    <EllipsisVertical className="h-5" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem>Edit</DropdownMenuItem>
                                    <DropdownMenuItem>Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <div className="pe-6 pb-4 ps-6 text-center mt--50 relative z-[1]">
                            <Image src={avatarImages[index % avatarImages.length]} alt="Image" width={100} height={100} className="border br-white border-width-2-px w-[100px] h-[100px] ms-auto me-auto -mt-[50px] rounded-full object-fit-cover" />
                            <h6 className="text-lg mb-0 mt-1.5">{userItem.firstName} {userItem.lastName}</h6>
                            <span className="text-neutral-500 dark:text-neutral-300 mb-4">{userItem.email}</span>

                            <div className="center-border relative bg-gradient-to-r from-red-500/10 to-red-50/25 rounded-lg p-3 flex items-center gap-4 before:absolute before:w-px before:h-full before:z-[1] before:bg-neutral-200 dark:before:bg-neutral-500 before:start-1/2">
                                <div className="text-center w-1/2">
                                    <h6 className="text-base mb-0">{roleLabels[userItem.role] || userItem.role}</h6>
                                    <span className="text-neutral-500 dark:text-neutral-300 text-sm mb-0">Role</span>
                                </div>
                                <div className="text-center w-1/2">
                                    <Badge variant={userItem.isActive ? "success" : "default"}>
                                        {userItem.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                    <span className="text-neutral-500 dark:text-neutral-300 text-sm mb-0">Status</span>
                                </div>
                            </div>
                            <Button className={cn(`bg-blue-50 hover:bg-primary dark:hover:bg-primary hover:text-white dark:hover:text-white dark:bg-primary/25 text-primary dark:text-blue-400 text-sm px-3 py-3 rounded-lg flex items-center justify-center mt-4 font-medium gap-2 w-full h-12`)}>
                                View Profile
                                <ChevronRight className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </div>
            )
        })
    );
};

export default UsersGridCard;
