export const dynamic = "force-dynamic";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <main className="min-h-screen">{children}</main>
        <Toaster position="top-center" reverseOrder={false} />
      </ThemeProvider>
    </SessionProvider>
  );
}
