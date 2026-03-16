import Logout from "@/components/auth/logout";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import userImg from "@/public/assets/images/user.png";
import { Mail, Settings, User } from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";

const ProfileDropdown = () => {
  const { data: session } = useSession();
  console.log("session", session?.user?.image);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "rounded-full sm:w-10 sm:h-10 w-8 h-8 bg-gray-200/75 hover:bg-slate-200 focus-visible:ring-0 dark:bg-slate-700 dark:hover:bg-slate-600 border-0 cursor-pointer data-[state=open]:bg-gray-300 data-[state=open]:ring-4 data-[state=open]:ring-slate-300 dark:data-[state=open]:ring-slate-500 dark:data-[state=open]:bg-slate-600"
          )}
        >
          {session?.user?.image ? (
            <Image
              src={session?.user?.image}
              className="rounded-full"
              width={40}
              height={40}
              alt={session?.user?.name ?? "User profile"}
            />
          ) : (
            <Image
              src={userImg}
              className="rounded-full"
              width={40}
              height={40}
              alt={"User profile"}
            />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="sm:w-[300px] min-w-[250px] right-[40px] absolute p-4 rounded-2xl overflow-hidden shadow-lg"
        side="bottom"
        align="end"
      >
        <div className="py-3 px-4 rounded-lg bg-primary/10 dark:bg-primar flex items-center justify-between">
          <div>
            <h6 className="text-lg text-neutral-900 dark:text-white font-semibold mb-0">
              {session?.user?.image && session?.user?.name
                ? session?.user?.name
                : "Robiul Hasan"}
            </h6>
            <span className="text-sm text-neutral-500 dark:text-neutral-300">
              Admin
            </span>
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto scroll-sm pt-4">
          <ul className="flex flex-col gap-3">
            <li>
              <Link
                href="/view-profile"
                className="text-black dark:text-white hover:text-primary dark:hover:text-primary flex items-center gap-3"
              >
                <User className="w-5 h-5" /> My Profile
              </Link>
            </li>
            <li>
              <Link
                href="/email"
                className="text-black dark:text-white hover:text-primary dark:hover:text-primary flex items-center gap-3"
              >
                <Mail className="w-5 h-5" /> Inbox
              </Link>
            </li>
            <li>
              <Link
                href="/company"
                className="text-black dark:text-white hover:text-primary dark:hover:text-primary flex items-center gap-3"
              >
                <Settings className="w-5 h-5" /> Settings
              </Link>
            </li>
            <li>
              <Logout />
            </li>
          </ul>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProfileDropdown;
