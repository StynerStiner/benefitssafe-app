"use client";

import { useSession } from "next-auth/react";

const OrgBadge = () => {
  const { data: session } = useSession();
  const orgName = (session?.user as { organizationName?: string })?.organizationName;

  if (!orgName) return null;

  return (
    <div className="hidden md:flex items-center px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary rounded-md">
      {orgName}
    </div>
  );
};

export default OrgBadge;
