"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export default function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextAuthSessionProvider
      // Pəncərə fokuslandıqda session-u yenilə
      refetchOnWindowFocus={true}
      // Hər 5 dəqiqədə bir session-u yenilə
      refetchInterval={5 * 60}
    >
      {children}
    </NextAuthSessionProvider>
  );
}
