'use client';

import { roleDisplay } from '@/lib/profile-config';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  image?: string;
  role?: string;
  title?: string;
  companyName?: string;
  firmName?: string;
  organizationName?: string;
  memberCode?: string | null;
  orgCode?: string | null;
}

const ViewProfileSidebar = () => {
  const { data: session } = useSession();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.email) {
      fetch('/api/users/profile')
        .then((res) => (res.ok ? res.json() : null))
        .then((data: UserProfile | null) => {
          if (data) setUser(data);
        })
        .catch(() => {
          // Fallback to session data if API fails
          if (session?.user) {
            setUser({
              id: session.user.id || '',
              firstName: session.user.firstName || session.user.name?.split(' ')[0] || '',
              lastName: session.user.lastName || session.user.name?.split(' ').slice(1).join(' ') || '',
              email: session.user.email || '',
              phone: '',
              image: session.user.image ?? undefined,
              role: session.user.role,
            });
          }
        })
        .finally(() => setLoading(false));
    }
  }, [session]);

  if (loading) {
    return (
      <div className="user-grid-card relative border border-slate-200 dark:border-slate-600 rounded-2xl overflow-hidden bg-white dark:bg-[#273142] h-full p-6">
        <div className="animate-pulse">
          <div className="h-[200px] bg-slate-200 dark:bg-slate-600 rounded-full mx-auto mb-4 w-[200px]"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded mb-2"></div>
          <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded w-2/3 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="user-grid-card relative border border-slate-200 dark:border-slate-600 rounded-2xl overflow-hidden bg-white dark:bg-[#273142] h-full p-6">
        <p className="text-center text-neutral-500">Unable to load profile</p>
      </div>
    );
  }

  const badge = user.role ? roleDisplay[user.role] : null;
  const contextLine = user.firmName || user.companyName || user.organizationName || user.title;

  return (
    <div className="user-grid-card relative border border-slate-200 dark:border-slate-600 rounded-2xl overflow-hidden bg-white dark:bg-[#273142] h-full">
      <div className="w-full h-[160px] bg-primary" aria-hidden="true" />
      <div className="pb-6 ms-6 mb-6 me-6 -mt-[100px]">
        <div className="text-center border-b border-slate-200 dark:border-slate-600">
          {user.image ? (
            <img src={user.image} alt={user.firstName} className="border-4 border-white dark:border-[#273142] w-[200px] h-[200px] rounded-full object-cover mx-auto" />
          ) : (
            <div className="border-4 border-white dark:border-[#273142] w-[200px] h-[200px] rounded-full bg-slate-300 mx-auto flex items-center justify-center">
              <span className="text-slate-600">No Image</span>
            </div>
          )}
          <h3 className="mb-0 mt-4 text-lg font-semibold">{user.firstName} {user.lastName}</h3>
          {badge && (
            <span
              className={`inline-flex items-center px-3 py-1 mt-2 rounded-full text-xs font-semibold ${badge.badgeClass}`}
              aria-label={`Role: ${badge.label}`}
            >
              {badge.label}
            </span>
          )}
          {user.memberCode && (
            <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400 mt-2" title="Your membership code in this organization">
              {user.memberCode}
            </p>
          )}
          <p className="text-neutral-500 dark:text-neutral-300 mt-2 mb-4 text-sm break-all">{user.email}</p>
        </div>
        <div className="mt-6">
          <h3 className="text-xl mb-4">Personal Info</h3>
          <ul>
            <li className="flex items-start gap-1 mb-3">
              <span className="w-[35%] text-base font-semibold text-neutral-600 dark:text-neutral-200 shrink-0">Full Name</span>
              <span className="w-[65%] text-neutral-500 dark:text-neutral-300 font-medium break-words">: {user.firstName} {user.lastName}</span>
            </li>
            <li className="flex items-start gap-1 mb-3">
              <span className="w-[35%] text-base font-semibold text-neutral-600 dark:text-neutral-200 shrink-0">Email</span>
              <span className="w-[65%] text-neutral-500 dark:text-neutral-300 font-medium break-all">: {user.email}</span>
            </li>
            <li className="flex items-start gap-1 mb-3">
              <span className="w-[35%] text-base font-semibold text-neutral-600 dark:text-neutral-200 shrink-0">Phone</span>
              <span className="w-[65%] text-neutral-500 dark:text-neutral-300 font-medium break-words">: {user.phone || 'Not provided'}</span>
            </li>
            {contextLine && (
              <li className="flex items-start gap-1 mb-3">
                <span className="w-[35%] text-base font-semibold text-neutral-600 dark:text-neutral-200 shrink-0">
                  {user.firmName ? 'Firm' : user.companyName ? 'Company' : user.organizationName ? 'Organization' : 'Title'}
                </span>
                <span className="w-[65%] text-neutral-500 dark:text-neutral-300 font-medium break-words">: {contextLine}</span>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ViewProfileSidebar;
