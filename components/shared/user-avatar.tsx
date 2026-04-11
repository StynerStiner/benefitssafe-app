"use client";

import { getInitials } from "@/lib/utils/get-initials";
import Image from "next/image";

interface UserAvatarProps {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

const COLORS = [
  "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-yellow-500",
  "bg-red-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500",
  "bg-orange-700", "bg-teal-500", "bg-emerald-500", "bg-violet-500",
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function UserAvatar({ firstName, lastName, name, avatarUrl, size = 40, className = "" }: UserAvatarProps) {
  const fullName = name?.trim() || `${firstName || ""} ${lastName || ""}`.trim();
  const initials = getInitials(fullName);
  const colorClass = getColor(fullName || "User");

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={fullName || "User"}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`${colorClass} rounded-full flex items-center justify-center text-white font-semibold shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      title={fullName || "User"}
    >
      {initials}
    </div>
  );
}
