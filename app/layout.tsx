import type { Metadata } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import ConditionalLayout from "@/components/ConditionalLayout";
import { ToastProvider } from "@/components/ui/toast-1";
import PageTransitionWrapper from "@/components/PageTransitionWrapper";
import PerformanceMonitor from "@/components/PerformanceMonitor";

export const metadata: Metadata = {
  title: "Ulvi Asad - Quiz, Test və Materiallar",
  description: "Ulvi Asad — müəllimlər və tələbələr üçün interaktiv təhsil platforması",
  viewport: "width=device-width, initial-scale=1",
  themeColor: "#1a7fe0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az">
      <head>
        {/* Inter şrifti CDN-dən yüklənir — build zamanı deyil, runtime-da */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body>
        <SessionProvider>
          <ToastProvider>
            <PageTransitionWrapper />
            {process.env.NODE_ENV === "development" && <PerformanceMonitor />}
            <ConditionalLayout>{children}</ConditionalLayout>
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
