"use client";

import { useEffect, useState } from "react";

export function useDirection() {
  const [direction, setDirection] = useState<"ltr" | "rtl">("ltr");

  useEffect(() => {
    const dir = document?.documentElement?.getAttribute("dir") as "ltr" | "rtl";
    setDirection(dir || "ltr");
  }, []);

  return direction;
}
