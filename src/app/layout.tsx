import type { Metadata } from "next";
import { Nunito, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SyncProvider } from "@/context/SyncContext";
import SmartSearch from "@/components/SmartSearch";
import SyncBanner from "@/components/SyncBanner";
import { Toaster } from "react-hot-toast";

const nunito = Nunito({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
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
      <body className={`${nunito.variable} ${jetbrainsMono.variable} font-sans h-full antialiased bg-background text-text-primary flex flex-col transition-colors duration-200 relative`} suppressHydrationWarning>
        {/* Global Mesh Gradient Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-purple-200 dark:bg-purple-900/30 blur-[120px] mix-blend-multiply dark:mix-blend-screen opacity-70 animate-[pulse_10s_ease-in-out_infinite]"></div>
          <div className="absolute top-[20%] -right-[10%] w-[40%] h-[60%] rounded-full bg-blue-200 dark:bg-blue-900/30 blur-[140px] mix-blend-multiply dark:mix-blend-screen opacity-70 animate-[pulse_12s_ease-in-out_infinite_1s]"></div>
          <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[50%] rounded-full bg-rose-200 dark:bg-rose-900/20 blur-[130px] mix-blend-multiply dark:mix-blend-screen opacity-60 animate-[pulse_14s_ease-in-out_infinite_2s]"></div>
        </div>

        <ThemeProvider>
          <AuthProvider>
            <SyncProvider>
              <SyncBanner />
              {children}
              <SmartSearch />
              <Toaster position="bottom-right" toastOptions={{ className: 'text-sm font-bold', style: { borderRadius: '16px' } }} />
            </SyncProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
