'use client';

import Image from 'next/image';
import Link from 'next/link';

import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed';
import { cn } from '@/lib/utils';
import LogoIcon from '@/public/assets/images/logo-icon.png';

function LogoSidebar() {
  const isCollapsed = useSidebarCollapsed();

  return (
    <Link
      href="/dashboard"
      className={cn(
        'sidebar-logo h-[72px] py-3.5 flex items-center border-b border-neutral-100 dark:border-slate-700',
        isCollapsed ? 'px-1 justify-center' : 'px-4 gap-3'
      )}
    >
      <Image
        src={LogoIcon}
        alt="BenefitsSafe"
        width={isCollapsed ? 36 : 40}
        height={isCollapsed ? 36 : 40}
        priority
        className="object-contain shrink-0"
      />
      {!isCollapsed && (
        <div className="min-w-0">
          <h2 className="text-base font-bold text-neutral-900 dark:text-white leading-tight truncate">BenefitsSafe</h2>
          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight truncate">Protecting Health, Security, and Growth.</p>
        </div>
      )}
    </Link>
  );
}

export default LogoSidebar;
