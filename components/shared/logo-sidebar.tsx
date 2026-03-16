'use client';

import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed';
import { cn } from '@/lib/utils';
import { Shield } from 'lucide-react';
import Link from 'next/link';

function LogoSidebar() {
  const isCollapsed = useSidebarCollapsed();

  return (
    <Link
      href="/dashboard"
      className={cn(
        'sidebar-logo h-[72px] py-3.5 flex items-center justify-center border-b border-neutral-100 dark:border-slate-700',
        isCollapsed ? 'px-1' : 'px-4'
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
          <Shield className="h-4.5 w-4.5" />
        </div>
        {!isCollapsed && (
          <span className="text-lg font-bold tracking-tight text-foreground dark:text-white">
            BenefitsSafe
          </span>
        )}
      </div>
    </Link>
  );
}

export default LogoSidebar;
