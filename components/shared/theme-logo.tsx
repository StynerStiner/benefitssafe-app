"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";

import LogoDark from "@/public/assets/images/logo.png";
import LogoWhite from "@/public/assets/images/logo-light.png";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";

function ThemeLogo() {
  const { theme } = useTheme();
  const isCollapsed = useSidebarCollapsed();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <Link href="/dashboard">
      <Image
        src={isMounted && theme === "dark" ? LogoWhite : LogoDark}
        alt="BenefitsSafe"
        width={200}
        height={200}
        priority
        className="object-contain"
      />
    </Link>
  );
}

export default ThemeLogo;
