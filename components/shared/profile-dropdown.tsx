import Logout from "@/components/auth/logout";
import UserAvatar from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Mail, Settings, User } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";

const ROLES_WITH_ORG_SETTINGS = new Set([
  "nonprofit_admin",
  "platform_admin",
  "billing_admin",
]);

const ProfileDropdown = () => {
  const { data: session } = useSession();

  const firstName = (session?.user as { firstName?: string })?.firstName || session?.user?.name?.split(" ")[0] || "";
  const lastName = (session?.user as { lastName?: string })?.lastName || session?.user?.name?.split(" ").slice(1).join(" ") || "";
  const avatarUrl = session?.user?.image || (session?.user as { avatarUrl?: string })?.avatarUrl || null;
  const role = (session?.user as { role?: string })?.role || "user";

  const roleLabels: Record<string, string> = {
    nonprofit_admin: "Admin",
    nonprofit_staff: "Staff",
    beneficiary: "Beneficiary",
    cpa: "CPA",
    auditor: "Auditor",
    attorney: "Attorney",
    vendor: "Vendor",
    platform_admin: "Platform Admin",
    grant_officer: "Grant Officer",
    compliance_officer: "Compliance",
    support_agent: "Support",
    billing_admin: "Billing",
  };

  const settingsHref = ROLES_WITH_ORG_SETTINGS.has(role)
    ? "/org-settings"
    : "/settings/billing";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="User menu"
          className={cn(
            "rounded-full sm:w-10 sm:h-10 w-8 h-8 bg-gray-200/75 hover:bg-slate-200 focus-visible:ring-0 dark:bg-slate-700 dark:hover:bg-slate-600 border-0 cursor-pointer data-[state=open]:bg-gray-300 data-[state=open]:ring-4 data-[state=open]:ring-slate-300 dark:data-[state=open]:ring-slate-500 dark:data-[state=open]:bg-slate-600 p-0 overflow-hidden"
          )}
        >
          <UserAvatar
            firstName={firstName}
            lastName={lastName}
            avatarUrl={avatarUrl}
            size={40}
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="sm:w-[300px] min-w-[250px] right-[40px] absolute p-4 rounded-2xl overflow-hidden shadow-lg"
        side="bottom"
        align="end"
      >
        <div className="py-3 px-4 rounded-lg bg-primary/10 dark:bg-primar flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserAvatar
              firstName={firstName}
              lastName={lastName}
              avatarUrl={avatarUrl}
              size={44}
            />
            <div>
              <h3 className="text-lg text-neutral-900 dark:text-white font-semibold mb-0">
                {firstName} {lastName}
              </h3>
              <span className="text-sm text-neutral-500 dark:text-neutral-300">
                {roleLabels[role] || role}
              </span>
            </div>
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto scroll-sm pt-4">
          <ul className="flex flex-col gap-3">
            <li>
              <Link
                href="/profile"
                className="text-black dark:text-white hover:text-primary dark:hover:text-primary flex items-center gap-3"
              >
                <User className="w-5 h-5" /> My Profile
              </Link>
            </li>
            <li>
              <Link
                href="/messages"
                className="text-black dark:text-white hover:text-primary dark:hover:text-primary flex items-center gap-3"
              >
                <Mail className="w-5 h-5" /> Inbox
              </Link>
            </li>
            <li>
              <Link
                href={settingsHref}
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
