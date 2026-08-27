import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShoppingBag, Trash2, Truck } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import ProductArt from "./ProductArt";
import QuantityStepper from "./QuantityStepper";
import { useCart } from "@/lib/CartContext";
import { formatPrice, FREE_SHIPPING_THRESHOLD } from "@/lib/products";
import { pageUrl, productUrl } from "@/lib/nav";

export default function CartDrawer() {
  const {
    items,
    count,
    subtotal,
    shipping,
    total,
    missingForFreeShipping,
    isOpen,
    setIsOpen,
    updateQuantity,
    removeItem,
  } = useCart();

  const close = () => setIsOpen(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent side="left" className="flex w-full flex-col gap-0 p-0 sm:max-w-md [&>button]:left-4 [&>button]:right-auto">
        <SheetHeader className="border-b border-border px-5 py-4 text-right">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <ShoppingBag size={18} className="text-primary" />
            העגלה שלי
            <span className="ltr-nums text-sm font-normal text-muted-foreground">({count})</span>
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-secondary">
              <ShoppingBag size={26} className="text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">העגלה עוד ריקה</p>
              <p className="mt-1 text-sm text-muted-foreground">
                כרטיס ביקור אחד חכם מחליף חפיסה שלמה של נייר.
              </p>
            </div>
            <Button asChild onClick={close} className="rounded-full font-semibold">
              <Link to={pageUrl("Shop")}>לחנות</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {missingForFreeShipping > 0 ? (
                <div className="mb-4 rounded-xl border border-border bg-secondary/50 p-3">
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Truck size={14} className="text-primary" />
                    עוד <span className="ltr-nums font-bold text-foreground">{formatPrice(missingForFreeShipping)}</span> ומשלוח חינם
                  </p>
                  <Progress value={(subtotal / FREE_SHIPPING_THRESHOLD) * 100} className="mt-2 h-1.5" />
                </div>
              ) : (
                <p className="mb-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs font-semibold text-primary">
                  <Truck size={14} />
                  יש! המשלוח עלינו
                </p>
              )}

              <ul className="space-y-3">
                {items.map(({ product, quantity, lineTotal }) => (
                  <li key={product.id} className="flex gap-3 rounded-xl border border-border/70 bg-card/50 p-3">
                    <Link
                      to={productUrl(product.id)}
                      onClick={close}
                      className="h-20 w-20 shrink-0 overflow-hidden rounded-lg"
                    >
                      <ProductArt product={product} />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex items-start gap-2">
                        <Link
                          to={productUrl(product.id)}
                          onClick={close}
                          className="line-clamp-2 flex-1 text-sm font-semibold leading-snug hover:text-primary"
                        >
                          {product.name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeItem(product.id)}
                          aria-label={`הסרת ${product.name}`}
                          className="text-muted-foreground transition hover:text-destructive"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <QuantityStepper
                          value={quantity}
                          onChange={(next) => updateQuantity(product.id, next)}
                        />
                        <span className="ltr-nums text-sm font-bold">{formatPrice(lineTotal)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-border bg-card/60 px-5 py-4">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <dt>סכום ביניים</dt>
                  <dd className="ltr-nums">{formatPrice(subtotal)}</dd>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>משלוח</dt>
                  <dd className="ltr-nums">{shipping === 0 ? "חינם" : formatPrice(shipping)}</dd>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-base font-extrabold">
                  <dt>סה״כ</dt>
                  <dd className="ltr-nums">{formatPrice(total)}</dd>
                </div>
              </dl>
              <Button asChild size="lg" onClick={close} className="mt-4 w-full gap-2 rounded-full text-base font-bold">
                <Link to={pageUrl("Checkout")}>
                  למעבר לתשלום
                  <ArrowLeft size={18} />
                </Link>
              </Button>
              <button
                type="button"
                onClick={close}
                className="mt-2 w-full py-1 text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                המשך בקניות
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
