"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { useThemeCustomizer } from "@/hooks/useThemeCustomizer";
import { cn } from "@/lib/utils";
import { ChevronRight, Settings, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface SidebarItem {
  title?: string;
  url?: string;
  icon?: LucideIcon;
  isActive?: boolean;
  items?: {
    title: string;
    url: string;
    circleColor: string;
  }[];
  label?: string;
};

export function NavMain({ items }: { items: SidebarItem[] }) {
  const pathname = usePathname();
  const isCollapsed = useSidebarCollapsed();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [manualClose, setManualClose] = useState<string | null>(null);
  const { setCustomizationOpen } = useThemeCustomizer();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(() => {
    fetch("/api/notifications?unread=true&limit=1")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.unreadCount !== undefined) setUnreadCount(data.unreadCount);
      })
      .catch(() => {});
  }, []);

  // Fetch unread count on mount and every 60 seconds
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    const handleFocus = () => fetchUnreadCount();
    window.addEventListener("focus", handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchUnreadCount]);

  // Auto-open the active group on route change, and clear manual close
  useEffect(() => {
    const activeGroup = items.find((item) =>
      item.items?.some((sub) => pathname === sub.url || pathname.startsWith(sub.url))
    );
    if (activeGroup?.title) {
      setOpenGroup(activeGroup.title);
      setManualClose(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleToggleGroup = (title?: string) => {
    if (!title) return;
    if (openGroup === title) {
      setOpenGroup(null);
      setManualClose(title);
    } else {
      setOpenGroup(title);
      setManualClose(null);
    }
  };

  return (
    <SidebarGroup className={`${isCollapsed ? "px-1.5" : ""}`}>
      <SidebarMenu>
        {items.map((item) => {
          const isGroupActive = item.items?.some(
            (subItem) =>
              pathname === subItem.url || pathname.startsWith(subItem.url)
          );

          if (item.items && item.items.length > 0) {
            const isOpen = manualClose === item.title ? false : (openGroup === item.title || isGroupActive);

            return (
              <Collapsible
                key={item.title}
                asChild
                open={isOpen}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip={item.title}
                      onClick={() => handleToggleGroup(item.title)}
                      className={cn(
                        "cursor-pointer py-5.5 px-3 text-base text-[#4b5563] dark:text-white data-[state=open]:bg-primary data-[state=open]:text-white hover:data-[state=open]:bg-primary dark:hover:data-[state=open]:bg-primary hover:data-[state=open]:text-white hover:bg-primary/10 active:bg-primary/10 dark:hover:bg-slate-700",
                        isOpen
                          ? "bg-primary text-white hover:bg-primary hover:text-white dark:bg-primary dark:hover:bg-primary"
                          : ""
                      )}
                    >
                      {item.icon && <item.icon className="!w-4.5 !h-4.5" />}
                      <span>{item.title}</span>
                      <ChevronRight className="ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub className="gap-0 mt-2 space-y-1">
                      {item.items.map((subItem) => {
                        const isSubActive =
                          pathname === subItem.url ||
                          pathname.startsWith(subItem.url);
                        return (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton
                              asChild={subItem.title !== "Theme"}
                              onClick={subItem.title === "Theme" ? () => setCustomizationOpen(true) : undefined}
                              className={cn(
                                "py-5.5 px-3 text-base text-[#4b5563] dark:text-white hover:bg-primary/10 active:bg-primary/10 dark:hover:bg-slate-700",
                                isSubActive
                                  ? "bg-primary/10 font-bold dark:bg-slate-600"
                                  : ""
                              )}
                            >
                              {subItem.title === "Theme" ? (
                                <button className="flex items-center gap-3.5 w-full">
                                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-white">
                                    <Settings className="w-3.5 h-3.5 animate-spin" />
                                  </div>
                                  <span>{subItem.title}</span>
                                </button>
                              ) : (
                                <Link
                                  href={subItem.url}
                                  className="flex items-center gap-3.5"
                                >
                                  <span
                                    className={`w-2 h-2 rounded-[50%] ${subItem.circleColor}`}
                                  ></span>
                                  <span>{subItem.title}</span>
                                </Link>
                              )}
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            );
          }

          if (item.label) {
            return (
              <SidebarGroupLabel key={`label-${item.label}`}>
                {item.label}
              </SidebarGroupLabel>
            );
          }

          if (item.url && item.title) {
            const isMenuActive =
              pathname === item.url || pathname.startsWith(item.url);

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  className={cn(
                    "cursor-pointer py-5.5 px-3 text-base text-[#4b5563] dark:text-white hover:bg-primary/10 active:bg-primary/10 dark:hover:bg-slate-700",
                    isMenuActive
                      ? "bg-primary hover:bg-primary text-white dark:hover:bg-primary hover:text-white"
                      : ""
                  )}
                >
                  <Link href={item.url} className="flex items-center gap-2">
                    {item.icon && <item.icon className="!w-4.5 !h-4.5" />}
                    <span>{item.title}</span>
                    {item.title === "Notifications" && unreadCount > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          }

          return null;
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
