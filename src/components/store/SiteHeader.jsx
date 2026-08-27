import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, Search, ShoppingBag, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/CartContext";
import { pageUrl } from "@/lib/nav";
import { FREE_SHIPPING_THRESHOLD, formatPrice } from "@/lib/products";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "בית", page: "Home" },
  { label: "חנות", page: "Shop" },
  { label: "איך זה עובד", page: "HowItWorks" },
  { label: "צור קשר", page: "Contact" },
];

export const Wordmark = ({ className }) => (
  <span className={cn("flex items-center gap-2", className)}>
    <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="2.2" strokeLinecap="round">
        <path d="M8 8a6 6 0 0 1 0 8" />
        <path d="M13 5a11 11 0 0 1 0 14" opacity="0.75" />
        <path d="M18 2.5a16 16 0 0 1 0 19" opacity="0.45" />
      </svg>
    </span>
    <span className="text-xl font-extrabold tracking-tight">
      Tap<span className="text-primary">It</span>
    </span>
  </span>
);

export default function SiteHeader({ currentPageName }) {
  const { count, openCart } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const isActive = (page) =>
    currentPageName === page || location.pathname === pageUrl(page) || (page === "Home" && location.pathname === "/");

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="border-b border-border/50 bg-gradient-to-l from-primary/10 via-accent/10 to-transparent">
        <p className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2 text-center text-[11px] font-medium text-muted-foreground sm:text-xs">
          <Sparkles size={13} className="text-primary" />
          משלוח חינם בהזמנה מעל <span className="ltr-nums font-bold text-foreground">{formatPrice(FREE_SHIPPING_THRESHOLD)}</span>
          <span className="hidden sm:inline">· אספקה תוך 3–5 ימי עסקים · תמיכה בעברית</span>
        </p>
      </div>

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link to={pageUrl("Home")} aria-label="TapIt — לדף הבית">
          <Wordmark />
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.page}
              to={pageUrl(item.page)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                isActive(item.page)
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-1.5 md:ms-0">
          <Button asChild variant="ghost" size="icon" className="rounded-full" aria-label="חיפוש מוצרים">
            <Link to={pageUrl("Shop")}>
              <Search size={19} />
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={openCart}
            aria-label={`עגלת קניות, ${count} פריטים`}
            className="relative rounded-full"
          >
            <ShoppingBag size={19} />
            {count > 0 && (
              <span className="ltr-nums absolute -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground ltr:-right-0.5 rtl:-left-0.5">
                {count}
              </span>
            )}
          </Button>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full md:hidden" aria-label="תפריט">
                <Menu size={20} />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 [&>button]:left-4 [&>button]:right-auto">
              <SheetHeader className="text-right">
                <SheetTitle>
                  <Wordmark />
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-8 flex flex-col gap-1">
                {NAV.map((item) => (
                  <Link
                    key={item.page}
                    to={pageUrl(item.page)}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "rounded-xl px-4 py-3 text-base font-semibold transition",
                      isActive(item.page) ? "bg-secondary" : "text-muted-foreground hover:bg-secondary/60"
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
