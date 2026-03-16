"use server";

import { cookies } from "next/headers";

export type LogoutResponse = { success: true } | { error: string };

export async function doLogout(): Promise<LogoutResponse> {
  try {
    const cookieStore = await cookies(); 

    cookieStore.delete("authjs.session-token"); 

    return { success: true };
  } catch (error) {
    console.error("Logout error:", error);
    return { error: "Logout failed. Please try again." };
  }
}
