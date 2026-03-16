import { LoadingProvider } from "@/contexts/LoadingContext";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wowdash - Tailwind & Next.js Admin Dashboard with shadcn UI (Typescript)",
  description: "BenefitsSafe - Admin Dashboard Multipurpose Next.js, TypeScript, ShadCn UI & Tailwind Template",
  metadataBase: new URL("https://wowdash-nextjs-typescript-shadcn-5fu5.vercel.app"),
  openGraph: {
    title: "Wowdash - Admin Dashboard UI",
    description: "A modern, responsive admin dashboard template built with Next.js, Tailwind CSS, and ShadCN UI.",
    url: "https://wowdash-nextjs-typescript-shadcn-5fu5.vercel.app",
    siteName: "Wowdash",
    images: [
      {
        url: "https://wowdash-nextjs-typescript-shadcn-5fu5.vercel.app/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Wowdash Admin Dashboard Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wowdash - Admin Dashboard UI",
    description: "A modern, responsive admin dashboard template built with Next.js, Tailwind CSS, and ShadCN UI.",
    images: ["https://wowdash-nextjs-typescript-shadcn-5fu5.vercel.app/og-image.jpg"],
  },
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
