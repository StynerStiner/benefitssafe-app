"use client";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import EmptyState from "@/components/shared/empty-state";
import { MessageSquare } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import ChatBox from "./components/chat-box";

// Page-level conversation-count probe so we can render a proper empty
// state instead of the ChatBox's blank panel when there are no threads.
// ChatBox still fetches the full list for itself when it renders; this
// is a lightweight pre-flight that only adds one request for brand-new
// users (the common empty case) and costs nothing once a user has any
// conversations at all.
type ProbeState = "loading" | "empty" | "has-conversations";

const MessagesPage = () => {
    const [probe, setProbe] = useState<ProbeState>("loading");

    useEffect(() => {
        let cancelled = false;
        fetch("/api/messages/conversations")
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (cancelled) return;
                const convos = data && "conversations" in data
                    ? data.conversations
                    : Array.isArray(data)
                        ? data
                        : [];
                setProbe(convos.length === 0 ? "empty" : "has-conversations");
            })
            .catch(() => {
                if (!cancelled) setProbe("empty");
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (probe === "loading") {
        return (
            <>
                <DashboardBreadcrumb title="Messages" text="Messages" />
                <LoadingSkeleton />
            </>
        );
    }

    if (probe === "empty") {
        return (
            <>
                <DashboardBreadcrumb title="Messages" text="Messages" />
                <div className="card rounded-xl border border-border bg-background shadow-sm">
                    <EmptyState
                        icon={MessageSquare}
                        title="No conversations yet"
                        message="Messages from your team, beneficiaries, and vendors will appear here. Start a conversation from a beneficiary or vendor profile page."
                        ctaLabel="View beneficiaries"
                        ctaHref="/beneficiaries"
                    />
                </div>
            </>
        );
    }

    return (
        <>
            <DashboardBreadcrumb title="Messages" text="Messages" />
            <Suspense fallback={<LoadingSkeleton />}>
                <ChatBox />
            </Suspense>
        </>
    );
};

export default MessagesPage;
