"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Mail, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface ConversationItem {
  id: string;
  subject: string | null;
  type: string;
  participants: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  }[];
  lastMessage: {
    content: string;
    senderId: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  updatedAt: string;
}

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const MessageDropdown = () => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);

  const fetchConversations = useCallback(() => {
    fetch("/api/messages/conversations?limit=5")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.conversations) {
          setConversations(data.conversations);
          setTotalUnread(
            data.conversations.reduce(
              (sum: number, c: ConversationItem) => sum + c.unreadCount,
              0
            )
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          className={cn(
            "rounded-[50%] text-neutral-900 sm:w-10 sm:h-10 w-8 h-8 bg-gray-200/75 hover:bg-slate-200 focus-visible:ring-0 dark:bg-slate-700 dark:hover:bg-slate-600 border-0 cursor-pointer data-[state=open]:bg-gray-300 dark:data-[state=open]:bg-slate-600 relative"
          )}
        >
          <Mail />
          {totalUnread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="sm:w-[400px] max-h-[unset] me-6 p-0 rounded-2xl overflow-hidden shadow-lg block">
        <div>
          <div className="py-3 px-4 rounded-lg bg-primary/10 dark:bg-primary/25 m-4 flex items-center justify-between gap-2">
            <h6 className="text-lg text-neutral-900 dark:text-white font-semibold mb-0">
              Messages
            </h6>
            {totalUnread > 0 && (
              <span className="sm:w-10 sm:h-10 w-8 h-8 bg-white dark:bg-slate-800 text-primary dark:text-primary font-bold flex justify-center items-center rounded-full text-sm">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </div>
          <div className="scroll-sm !border-t-0">
            <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-invisible hover:scrollbar-visible">
              {conversations.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <MessageSquare className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">No messages yet</p>
                </div>
              ) : (
                conversations.map((c) => {
                  const other = c.participants[0];
                  const displayName = other
                    ? `${other.firstName} ${other.lastName}`
                    : c.subject || "Conversation";
                  const initials = other
                    ? `${other.firstName.charAt(0)}${other.lastName.charAt(0)}`
                    : "??";
                  const preview = c.lastMessage?.content || "No messages yet";
                  const time = c.lastMessage
                    ? relativeTime(c.lastMessage.createdAt)
                    : "";

                  return (
                    <Link
                      key={c.id}
                      href="/messages"
                      className={`flex px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-600 justify-between gap-1 ${
                        c.unreadCount > 0
                          ? "bg-blue-50/50 dark:bg-slate-700/50"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 relative">
                          <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold">
                            {initials}
                          </div>
                          <span className="absolute end-[2px] -bottom-[1px] w-2.5 h-2.5 bg-green-500 border border-white rounded-full dark:border-gray-600" />
                        </div>
                        <div className="min-w-0">
                          <h6 className="text-sm font-semibold mb-0.5 truncate max-w-[220px]">
                            {displayName}
                          </h6>
                          <p className="mb-0 text-xs text-neutral-500 line-clamp-1">
                            {preview}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <span className="text-xs text-neutral-500 dark:text-neutral-300 whitespace-nowrap">
                          {time}
                        </span>
                        {c.unreadCount > 0 && (
                          <span className="w-4 h-4 text-xs bg-primary text-white rounded-full flex justify-center items-center">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>

            <div className="text-center py-3 px-4 border-t border-neutral-200 dark:border-slate-700">
              <Link
                href="/messages"
                className="text-primary dark:text-primary font-semibold hover:underline text-center text-sm"
              >
                See All Messages
              </Link>
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default MessageDropdown;
