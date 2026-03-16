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
import { cn } from "@/lib/utils";
import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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

  const handleToggleGroup = (title?: string) => {
    if (!title) return;
    setOpenGroup((prev) => (prev === title ? null : title));
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
            const isOpen = openGroup === item.title || isGroupActive;

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
                              asChild
                              className={cn(
                                "py-5.5 px-3 text-base text-[#4b5563] dark:text-white hover:bg-primary/10 active:bg-primary/10 dark:hover:bg-slate-700",
                                isSubActive
                                  ? "bg-primary/10 font-bold dark:bg-slate-600"
                                  : ""
                              )}
                            >
                              <Link
                                href={subItem.url}
                                className="flex items-center gap-3.5"
                              >
                                <span
                                  className={`w-2 h-2 rounded-[50%] ${subItem.circleColor}`}
                                ></span>
                                <span>{subItem.title}</span>
                              </Link>
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
