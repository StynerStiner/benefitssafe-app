import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { Ban, CircleX, EllipsisVertical, ImageIcon, LinkIcon, Loader2, MessageSquarePlus, Phone, Send, Settings, User, Video } from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import UserAvatar from "@/components/shared/user-avatar";

// --- CHANGED: Types for API data ---
interface ConvoParticipant { userId: string; firstName?: string; lastName?: string; email?: string; }
interface ConvoLastMessage { content: string; senderId: string; createdAt: string; }
interface ConversationItem { id: string; subject: string | null; type: string; updatedAt: string; participants: ConvoParticipant[]; lastMessage: ConvoLastMessage | null; unreadCount: number; }
// Legacy types kept for backward compat with message fetching
interface ConvoParticipantLegacy { userId: string; }
interface ConvoLastMsg { id: string; content: string; senderId: string; createdAt: string; }
interface Conversation { id: string; subject: string | null; type: string; updatedAt: string; participants: ConvoParticipantLegacy[]; messages: ConvoLastMsg[]; }

interface OrgUser { id: string; firstName: string; lastName: string; email: string; role: string; }
interface ApiMessage { id: string; senderId: string; content: string; createdAt: string; }

type ChatItem = {
    id: number | string;
    name: string;
    message: string;
    time: string;
    unreadCount: number;
    isActive?: boolean;
};

type PrevChatMessage = {
    id: number | string;
    sender: "me" | "other";
    senderName?: string;
    text: string;
    time: string;
};

function formatTime(d: string) {
    const dt = new Date(d);
    let hours = dt.getHours();
    const minutes = dt.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
}

function relativeTime(d: string) {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

const ChatBox = () => {

    const { data: session } = useSession();
    const currentUserId = session?.user?.id;

    // --- CHANGED: State for API data instead of hardcoded arrays ---
    const [chatList, setChatList] = useState<ChatItem[]>([]);
    const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);
    const [prevData, setPrevData] = useState<PrevChatMessage[]>([]);
    const [selectedName, setSelectedName] = useState("Select a conversation");
    const [message, setMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // New message dialog state
    const [newMsgOpen, setNewMsgOpen] = useState(false);
    const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
    const [newMsgRecipient, setNewMsgRecipient] = useState("");
    const [newMsgSubject, setNewMsgSubject] = useState("");
    const [newMsgBody, setNewMsgBody] = useState("");
    const [newMsgSending, setNewMsgSending] = useState(false);
    const [newMsgError, setNewMsgError] = useState<string | null>(null);

    const chatContainerRef = useRef<HTMLDivElement | null>(null);

    // Fetch org users when dialog opens
    useEffect(() => {
        if (!newMsgOpen) return;
        fetch("/api/users?limit=50")
            .then((r) => r.ok ? r.json() : null)
            .then((data) => {
                if (data?.users) {
                    // Filter out the current user
                    setOrgUsers(data.users.filter((u: OrgUser) => u.id !== currentUserId));
                }
            })
            .catch(() => {});
    }, [newMsgOpen, currentUserId]);

    // Handle creating a new conversation
    const handleNewConversation = async () => {
        if (!newMsgRecipient || !newMsgBody.trim()) return;
        setNewMsgSending(true);
        setNewMsgError(null);

        try {
            const res = await fetch("/api/messages/conversations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recipientId: newMsgRecipient,
                    subject: newMsgSubject.trim() || undefined,
                    message: newMsgBody.trim(),
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                setNewMsgError(err.error || "Failed to create conversation.");
                return;
            }

            const data = await res.json();

            // Reset form and close dialog
            setNewMsgRecipient("");
            setNewMsgSubject("");
            setNewMsgBody("");
            setNewMsgOpen(false);

            // Refresh conversations and select the new one
            fetchConversations(false);
            if (data.conversationId) {
                setSelectedConvoId(data.conversationId);
                const recipient = orgUsers.find((u) => u.id === newMsgRecipient);
                setSelectedName(
                    newMsgSubject.trim() ||
                    (recipient ? `${recipient.firstName} ${recipient.lastName}` : "Conversation")
                );
            }
        } catch {
            setNewMsgError("Failed to send message. Please try again.");
        } finally {
            setNewMsgSending(false);
        }
    };

    // Shared function to fetch and map conversations
    const fetchConversations = useCallback((selectFirst = false) => {
        fetch("/api/messages/conversations")
            .then((r) => r.ok ? r.json() : null)
            .then((data: { conversations?: ConversationItem[] } | Conversation[] | null) => {
                // Handle both response formats: { conversations: [...] } or flat array
                let convos: ConversationItem[];
                if (data && "conversations" in data && Array.isArray(data.conversations)) {
                    convos = data.conversations;
                } else if (Array.isArray(data)) {
                    // Legacy flat array format
                    convos = (data as Conversation[]).map((c) => ({
                        id: c.id,
                        subject: c.subject,
                        type: c.type,
                        updatedAt: c.updatedAt,
                        participants: c.participants,
                        lastMessage: c.messages?.[0] ? {
                            content: c.messages[0].content,
                            senderId: c.messages[0].senderId,
                            createdAt: c.messages[0].createdAt,
                        } : null,
                        unreadCount: 0,
                    }));
                } else {
                    setChatList([]);
                    setPrevData([]);
                    return;
                }

                if (convos.length === 0) {
                    setChatList([]);
                    setPrevData([]);
                    return;
                }
                const mapped: ChatItem[] = convos.map((c, i) => {
                    // Build a display name from participants or subject
                    const participantName = c.participants
                        ?.map((p) => p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : null)
                        .filter(Boolean)
                        .join(", ");
                    const displayName = c.subject || participantName || c.type || "Conversation";

                    return {
                        id: c.id,
                        name: displayName,
                        message: c.lastMessage?.content?.substring(0, 30) || "No messages",
                        time: relativeTime(c.updatedAt || c.lastMessage?.createdAt || new Date().toISOString()),
                        unreadCount: c.unreadCount || 0,
                        isActive: i < 5,
                    };
                });
                setChatList(mapped);
                if (selectFirst && mapped.length > 0) {
                    setSelectedConvoId(mapped[0].id as string);
                    setSelectedName(mapped[0].name);
                }
            })
            .catch(() => {});
    }, []);

    // Fetch conversations on mount
    useEffect(() => {
        fetchConversations(true);
    }, [fetchConversations]);

    // Poll conversation list every 10 seconds for new conversations and unread counts
    useEffect(() => {
        const interval = setInterval(() => {
            fetchConversations(false);
        }, 10000);

        return () => clearInterval(interval);
    }, [fetchConversations]);

    // Track message count for efficient polling comparison
    const messageCountRef = useRef(0);

    // Shared function to fetch messages for a conversation
    const fetchMessages = useCallback((convoId: string) => {
        fetch(`/api/messages/conversations/${convoId}`)
            .then((r) => r.ok ? r.json() : null)
            .then((data) => {
                const msgs: ApiMessage[] = data?.messages || (Array.isArray(data) ? data : []);
                // Only update state if message count changed (avoids unnecessary re-renders)
                if (msgs.length !== messageCountRef.current) {
                    messageCountRef.current = msgs.length;
                    const mapped: PrevChatMessage[] = msgs.map((m) => ({
                        id: m.id,
                        sender: m.senderId === currentUserId ? "me" as const : "other" as const,
                        senderName: selectedName,
                        text: m.content,
                        time: formatTime(m.createdAt),
                    }));
                    setPrevData(mapped);
                }
            })
            .catch(() => {});
    }, [currentUserId]);

    // Fetch messages when conversation selected
    useEffect(() => {
        if (!selectedConvoId) return;
        messageCountRef.current = 0; // Reset on conversation change
        fetchMessages(selectedConvoId);
    }, [selectedConvoId, fetchMessages]);

    // Poll messages every 5 seconds for near real-time updates
    useEffect(() => {
        if (!selectedConvoId) return;

        const interval = setInterval(() => {
            fetchMessages(selectedConvoId);
        }, 5000);

        return () => clearInterval(interval);
    }, [selectedConvoId, fetchMessages]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior: "smooth",
            });

        }
    }, [prevData]);


    // --- CHANGED: Send via API instead of local state only ---
    const handleSubmitMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !selectedConvoId) return;
        setIsSubmitting(true);

        const now = new Date();
        let hours = now.getHours();
        const minutes = now.getMinutes();
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;

        try {
            const res = await fetch(`/api/messages/conversations/${selectedConvoId}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: message.trim() }),
            });
            if (res.ok) {
                setPrevData((prev) => [
                    ...prev,
                    {
                        id: Date.now(),
                        sender: "me",
                        text: message,
                        time: `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`,
                    },
                ]);
            }
        } catch { /* silently fail */ }

        setMessage("");
        setTimeout(() => {
            setIsSubmitting(false)
        }, 500);
    }

    return (
        <div className="chat-wrapper grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="card border-0 overflow-hidden !p-0 col-span-12 md:col-span-4 xl:col-span-3">
                <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-4">
                    <div className="flex items-center gap-4">
                        <div className="">
                            <UserAvatar firstName={session?.user?.name?.split(" ")[0]} lastName={session?.user?.name?.split(" ").slice(1).join(" ")} size={40} />
                        </div>
                        <div className="">
                            <h6 className="text-base mb-0">{session?.user?.name || "User"}</h6>
                            <p className="mb-0 text-neutral-500 dark:text-neutral-100">Available</p>
                        </div>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger>
                            <EllipsisVertical width={20} className='text-neutral-500 dark:text-neutral-100' />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem className='text-neutral-600 dark:text-neutral-100'>
                                <User width={18} className='text-neutral-600 dark:text-neutral-100' />
                                Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem className='text-neutral-600 dark:text-neutral-100'>
                                <Settings width={18} className='text-neutral-600 dark:text-neutral-100' />
                                Profile
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <Command>
                    <div className="border-t border-neutral-200 flex items-center gap-2 pr-2">
                        <CommandInput placeholder="Search user..." className='' />
                        <Dialog open={newMsgOpen} onOpenChange={setNewMsgOpen}>
                            <DialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0 text-primary hover:bg-primary/10"
                                >
                                    <MessageSquarePlus width={20} />
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>New Message</DialogTitle>
                                    <DialogDescription>
                                        Start a new conversation with a team member.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="newMsgRecipient" className="text-sm font-semibold text-neutral-600 dark:text-neutral-200">
                                            Recipient <span className="text-red-600">*</span>
                                        </Label>
                                        <Select value={newMsgRecipient} onValueChange={setNewMsgRecipient}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a recipient" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {orgUsers.map((u) => (
                                                    <SelectItem key={u.id} value={u.id}>
                                                        {u.firstName} {u.lastName} ({u.role})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="newMsgSubject" className="text-sm font-semibold text-neutral-600 dark:text-neutral-200">
                                            Subject
                                        </Label>
                                        <Input
                                            id="newMsgSubject"
                                            placeholder="Optional subject"
                                            value={newMsgSubject}
                                            onChange={(e) => setNewMsgSubject(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="newMsgBody" className="text-sm font-semibold text-neutral-600 dark:text-neutral-200">
                                            Message <span className="text-red-600">*</span>
                                        </Label>
                                        <Textarea
                                            id="newMsgBody"
                                            placeholder="Write your message..."
                                            value={newMsgBody}
                                            onChange={(e) => setNewMsgBody(e.target.value)}
                                            rows={4}
                                        />
                                    </div>
                                    {newMsgError && (
                                        <p className="text-red-500 text-sm">{newMsgError}</p>
                                    )}
                                </div>
                                <DialogFooter>
                                    <Button
                                        onClick={handleNewConversation}
                                        disabled={!newMsgRecipient || !newMsgBody.trim() || newMsgSending}
                                        className="rounded-lg inline-flex items-center gap-1"
                                    >
                                        {newMsgSending ? (
                                            <>
                                                <Loader2 width={16} className="animate-spin" />
                                                Sending
                                            </>
                                        ) : (
                                            <>
                                                <Send width={16} />
                                                Send
                                            </>
                                        )}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                    <CommandList className='max-h-[580px]'>
                        <CommandEmpty>No conversations found.</CommandEmpty>
                        <CommandGroup className='p-0'>
                            {chatList.map(({ id, name, message, time, unreadCount, isActive }) => (
                                <CommandItem
                                    key={id}
                                    value={name}
                                    className='p-0'
                                    onSelect={() => { setSelectedConvoId(id as string); setSelectedName(name); }}
                                >
                                    <Link
                                        key={id}
                                        href="#"
                                        onClick={(e) => { e.preventDefault(); setSelectedConvoId(id as string); setSelectedName(name); }}
                                        className={`flex items-center justify-between gap-2 cursor-pointer hover:bg-neutral-50 dark:hover:bg-slate-700 px-6 py-2.5 w-full ${id === selectedConvoId ? "bg-neutral-100 dark:bg-slate-600" : ""} ${isActive ? "active" : ""}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="img">
                                                <UserAvatar firstName={name.split(" ")[0]} lastName={name.split(" ").slice(1).join(" ")} size={40} />
                                            </div>
                                            <div className="info">
                                                <h6 className="text-sm mb-1 line-clamp-1">{name}</h6>
                                                <p className="mb-0 text-xs line-clamp-1">{message}</p>
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-end">
                                            <p className="mb-0 text-neutral-400 text-xs lh-1">{time}</p>
                                            {unreadCount > 0 && (
                                                <span className="w-4 h-4 text-xs rounded-full bg-yellow-500 text-white inline-flex items-center justify-center">
                                                    {unreadCount}
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>


            </div>



            <div className=" col-span-12 md:col-span-8 xl:col-span-9">
                <div className="card border-0 overflow-hidden !p-0 flex flex-col">
                    <div className="flex items-center justify-between gap-2  px-6 py-2.5 active border-b border-neutral-200 dark:border-neutral-600">
                        <div className="flex items-center gap-2">
                            <div className="img">
                                <UserAvatar firstName={selectedName.split(" ")[0]} lastName={selectedName.split(" ").slice(1).join(" ")} size={40} />
                            </div>
                            <div className="info">
                                <h6 className="text-base mb-0">{selectedName}</h6>
                                <p className="mb-0 text-neutral-500 dark:text-neutral-100">Available</p>
                            </div>
                        </div>
                        <div className="action inline-flex items-center gap-3">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button type="button" className="text-xl text-neutral-600 dark:text-neutral-200 flex !p-0 bg-transparent hover:bg-transparent">
                                        <Phone width={20} className='text-neutral-500 dark:text-neutral-100' />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Audio Call</p>
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button type="button" className="text-xl text-neutral-600 dark:text-neutral-200 flex !p-0 bg-transparent hover:bg-transparent">
                                        <Video width={20} className='text-neutral-500 dark:text-neutral-100' />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Video Call</p>
                                </TooltipContent>
                            </Tooltip>

                            <DropdownMenu>
                                <DropdownMenuTrigger>
                                    <EllipsisVertical width={20} className='text-neutral-500 dark:text-neutral-100' />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem className='text-neutral-600 dark:text-neutral-100'>
                                        <CircleX width={20} className='text-neutral-500 dark:text-neutral-100' />
                                        All Clear
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className='text-neutral-600 dark:text-neutral-100'>
                                        <Ban width={20} className='text-neutral-500 dark:text-neutral-100' />
                                        Block
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                        </div>
                    </div>

                    <div
                        ref={chatContainerRef}
                        className="chat-message-list max-h-[568px] overflow-y-auto flex flex-col p-6 gap-6">
                        {prevData.map((msg) =>
                            msg.sender === "other" ? (
                                <div
                                    key={msg.id}
                                    className="max-w-[700px] duration-500 text-neutral-900 flex items-end gap-3"
                                >
                                    <UserAvatar
                                        firstName={msg.senderName?.split(" ")[0]}
                                        lastName={msg.senderName?.split(" ").slice(1).join(" ")}
                                        size={40}
                                    />
                                    <div className="bg-neutral-50 dark:bg-slate-800 dark:text-white rounded-2xl rounded-es-none p-5">
                                        <p className="mb-3">{msg.text}</p>
                                        <p className="chat-time mb-0 text-xs text-end text-neutral-500 dark:text-neutral-100">
                                            <span>{msg.time}</span>
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    key={msg.id}
                                    className="max-w-[700px] duration-500 ms-auto text-white"
                                >
                                    <div className="bg-primary rounded-2xl rounded-ee-none p-5">
                                        <p className="mb-3">{msg.text}</p>
                                        <p className="chat-time mb-0 text-xs">
                                            <span>{msg.time}</span>
                                        </p>
                                    </div>
                                </div>
                            )
                        )}
                    </div>

                    <form
                        className="chat-message-box flex items-center justify-between py-4 border-t border-neutral-200 dark:border-neutral-600 mt-auto px-3"
                        onSubmit={handleSubmitMessage}
                    >
                        <Textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className={cn(
                                `border-0 focus:border-0 grow bg-white dark:bg-transparent
                                focus:outline-none focus:ring-0 py-2 px-3 focus-visible:ring-0
                                resize-none shadow-none h-5`
                            )}
                            autoComplete="off"
                            name="chatMessage"
                            placeholder="Write message"
                            required
                        />


                        <div className="chat-message-box-action flex items-center gap-4">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Label
                                        htmlFor="addAttachment"
                                        className="text-xl flex !p-0 bg-transparent hover:bg-transparent cursor-pointer"
                                    >
                                        <LinkIcon
                                            width={20}
                                            className="text-neutral-500 dark:text-neutral-100 hover:text-primary"
                                        />
                                        <Input type="file" id="addAttachment" hidden />
                                    </Label>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Add Attachment</p>
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Label
                                        htmlFor="addImage"
                                        className="text-xl flex !p-0 bg-transparent hover:bg-transparent cursor-pointer"
                                    >
                                        <ImageIcon
                                            width={20}
                                            className="text-neutral-500 dark:text-neutral-100 hover:text-primary"
                                        />
                                        <Input type="file" id="addImage" hidden />
                                    </Label>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Add Image</p>
                                </TooltipContent>
                            </Tooltip>



                            <Button
                                type="submit"
                                className="rounded-lg inline-flex items-center gap-1"
                            >
                                {
                                    isSubmitting ? "Sending" : "Send"
                                }
                                <Send width={20} />
                            </Button>
                        </div>
                    </form>

                </div>
            </div>
        </div >
    );
};

export default ChatBox;
