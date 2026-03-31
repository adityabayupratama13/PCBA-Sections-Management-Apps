import type { Metadata } from 'next';
import "./globals.css";
import { Providers } from "@/context/Providers";
import { AuthGuard } from "@/components/AuthGuard";
import { CommandPalette } from "@/components/CommandPalette";
import { OnboardingTour } from "@/components/OnboardingTour";
import { LayoutWrapper } from "@/components/LayoutWrapper";
import localFont from "next/font/local";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "PCBA Sections Management Dashboard",
  description: "Internal dashboard for PCBA operations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <Providers>
          <AuthGuard>
            <CommandPalette />
            <OnboardingTour />
            <LayoutWrapper>{children}</LayoutWrapper>
          </AuthGuard>
        </Providers>
      </body>
    </html>
  );
}
