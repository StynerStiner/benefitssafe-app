import { LoadingProvider } from "@/contexts/LoadingContext";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "BenefitsSafe - Grant Disbursement Platform",
  description: "BenefitsSafe dashboard - Manage nonprofit grant disbursements, virtual cards, and SSI/Medi-Cal compliance monitoring without risking beneficiary benefits.",
  keywords: ["nonprofit", "grant management", "SSI", "Medi-Cal", "virtual cards", "compliance", "fintech"],
  metadataBase: new URL(process.env.NEXTAUTH_URL || "http://localhost:3002"),
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "BenefitsSafe - Grant Disbursement for Nonprofits",
    description: "Secure, compliant grant disbursement platform for nonprofits serving benefit-eligible populations.",
    url: process.env.NEXTAUTH_URL || "http://localhost:3002",
    siteName: "BenefitsSafe",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BenefitsSafe - Grant Disbursement Platform",
    description: "Secure grant disbursement for nonprofits. Keep beneficiaries safe. Keep grants compliant.",
  },
  // Icons auto-served from app/icon.png and app/apple-icon.png
};


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning={true}>
        <LoadingProvider>
          {children}
        </LoadingProvider>
      </body>
    </html>
  );
}
