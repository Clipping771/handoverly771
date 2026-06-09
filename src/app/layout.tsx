import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SyncProvider } from "@/context/SyncContext";
import SmartSearch from "@/components/SmartSearch";
import SyncBanner from "@/components/SyncBanner";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Handoverly — AI-Powered Shift Handover for Aged Care",
  description: "AI-Powered Shift Handover Platform for Australian Residential Aged Care. Converts unstructured shift notes into structured ISBAR summaries and carer task lists.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} h-full antialiased bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col transition-colors duration-200`} suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            <SyncProvider>
              <SyncBanner />
              {children}
              <SmartSearch />
              <Toaster position="bottom-right" toastOptions={{ className: 'text-sm font-medium' }} />
            </SyncProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
