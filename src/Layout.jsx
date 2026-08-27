import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import SiteHeader from "@/components/store/SiteHeader";
import SiteFooter from "@/components/store/SiteFooter";
import CartDrawer from "@/components/store/CartDrawer";

export default function Layout({ children, currentPageName }) {
  const { pathname, search } = useLocation();

  // Every page starts at the top — including product-to-product navigation.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname, search]);

  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-background">
      <SiteHeader currentPageName={currentPageName} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <CartDrawer />
    </div>
  );
}
