"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { memo } from "react";

function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth  = pathname.startsWith("/auth");
  const isAdmin = pathname.startsWith("/admin");

  // Auth və Admin səhifələrində header/footer yoxdur
  if (isAuth || isAdmin) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <>
      <Header />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </>
  );
}

export default memo(ConditionalLayout);
