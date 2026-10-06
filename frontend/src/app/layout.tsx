import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RoleProvider } from "@/lib/role-context";
import { AppShell } from "@/components/app-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Claims Workbench",
  description: "Claim Readiness Pack — synthetic data demonstration",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <ThemeProvider>
          <MotionConfig reducedMotion="user">
            <TooltipProvider>
              <RoleProvider>
                <AppShell>{children}</AppShell>
              </RoleProvider>
            </TooltipProvider>
          </MotionConfig>
        </ThemeProvider>
      </body>
    </html>
  );
}
