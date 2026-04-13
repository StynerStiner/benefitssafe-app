"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaOnClick?: () => void;
  secondary?: ReactNode;
  className?: string;
}

// Reusable page/card-level empty state. Use when a whole list or section
// has no data — not for inline "—" cell placeholders. Icon is optional
// (defaults to Inbox). CTA is optional and accepts either an href or a
// click handler.
export default function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  ctaLabel,
  ctaHref,
  ctaOnClick,
  secondary,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-6",
        className,
      )}
    >
      <div className="w-14 h-14 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-primary" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">
        {title}
      </h3>
      {message && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mb-4">
          {message}
        </p>
      )}
      {ctaLabel && (ctaHref || ctaOnClick) && (
        ctaHref ? (
          <Button asChild size="sm">
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        ) : (
          <Button size="sm" onClick={ctaOnClick}>
            {ctaLabel}
          </Button>
        )
      )}
      {secondary && <div className="mt-3">{secondary}</div>}
    </div>
  );
}
