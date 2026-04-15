"use client";

import { ComplianceChat } from "@/components/ai/compliance-chat";
import { AppSidebar } from "@/components/app-sidebar";
import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import ThemeCustomizer from "@/components/theme-customizer/theme-customizer";
import PlatformAdminBanner from "@/components/shared/platform-admin-banner";
import TrialBanner from "@/components/shared/trial-banner";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ThemeCustomizerProvider } from "@/hooks/useThemeCustomizer";
import { useSession } from "next-auth/react";
import { ReactNode } from "react";
import { Toaster } from "react-hot-toast";

const AI_CHAT_ROLES = [
  "nonprofit_admin", "nonprofit_staff", "cpa", "auditor",
  "attorney", "grant_officer", "platform_admin", "compliance_officer",
];

function ComplianceChatWrapper() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  if (!role || !AI_CHAT_ROLES.includes(role)) return null;
  return <ComplianceChat />;
}

export function ClientRoot({
  defaultOpen,
  children,
}: {
  defaultOpen: boolean;
  children: ReactNode;
}) {
  return (
    <ThemeCustomizerProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <SidebarProvider defaultOpen={defaultOpen}>
          <AppSidebar />
          <main className="dashboard-body-wrapper grow-[1] flex flex-col min-w-0 max-w-full">
            <SidebarInset>
              <Header />
            </SidebarInset>
            <PlatformAdminBanner />
            <TrialBanner />
            <div className="dashboard-body bg-neutral-100 dark:bg-[#1e2734] md:p-6 p-3 flex-1 overflow-x-hidden min-w-0 max-w-full">
              {children}
            </div>
            <Footer />
          </main>
          <ThemeCustomizer />
          <Toaster position="top-center" reverseOrder={false} />
          <ComplianceChatWrapper />
        </SidebarProvider>
      </ThemeProvider>
    </ThemeCustomizerProvider>
  );
}
