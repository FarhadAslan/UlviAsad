import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import ConditionalLayout from "@/components/ConditionalLayout";
import { ToastProvider } from "@/components/ui/toast-1";
import PageTransitionWrapper from "@/components/PageTransitionWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ulvi Asad - Quiz, Test və Materiallar",
  description: "Ulvi Asad — müəllimlər və tələbələr üçün interaktiv təhsil platforması",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az">
      <body className={inter.className}>
        <SessionProvider>
          <ToastProvider>
            <PageTransitionWrapper />
            <ConditionalLayout>{children}</ConditionalLayout>
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
