import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, ShoppingBag, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import ProductArt from "@/components/store/ProductArt";
import QuantityStepper from "@/components/store/QuantityStepper";
import ProductCard from "@/components/store/ProductCard";
import { useCart } from "@/lib/CartContext";
import { PRODUCTS, formatPrice, FREE_SHIPPING_THRESHOLD } from "@/lib/products";
import { pageUrl, productUrl } from "@/lib/nav";

export default function Cart() {
  const {
    items,
    count,
    subtotal,
    shipping,
    total,
    missingForFreeShipping,
    updateQuantity,
    removeItem,
    clearCart,
  } = useCart();

  if (items.length === 0) {
    const suggestions = PRODUCTS.filter((p) => p.bestseller).slice(0, 4);
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-secondary">
            <ShoppingBag size={30} className="text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold">העגלה ריקה</h1>
            <p className="mt-2 text-muted-foreground">בואו נתחיל עם משהו מהמוצרים שהכי מבוקשים אצלנו.</p>
          </div>
          <Button asChild size="lg" className="gap-2 rounded-full font-bold">
            <Link to={pageUrl("Shop")}>
              לחנות
              <ArrowLeft size={18} />
            </Link>
          </Button>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {suggestions.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="ltr-nums text-3xl font-black">
          העגלה שלי <span className="text-lg font-semibold text-muted-foreground">({count} פריטים)</span>
        </h1>
        <button
          type="button"
          onClick={clearCart}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-destructive"
        >
          <Trash2 size={15} />
          ריקון העגלה
        </button>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <ul className="space-y-4">
          {items.map(({ product, quantity, lineTotal }) => (
            <li
              key={product.id}
              className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/40 p-4 sm:flex-row"
            >
              <Link
                to={productUrl(product.id)}
                className="h-32 w-full shrink-0 overflow-hidden rounded-xl sm:h-28 sm:w-36"
              >
                <ProductArt product={product} />
              </Link>

              <div className="flex flex-1 flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link to={productUrl(product.id)} className="text-lg font-bold hover:text-primary">
                      {product.name}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.short}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(product.id)}
                    aria-label={`הסרת ${product.name}`}
                    className="shrink-0 text-muted-foreground transition hover:text-destructive"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                  <QuantityStepper value={quantity} onChange={(next) => updateQuantity(product.id, next)} />
                  <div className="text-end">
                    <p className="ltr-nums text-lg font-extrabold">{formatPrice(lineTotal)}</p>
                    {quantity > 1 && (
                      <p className="ltr-nums text-xs text-muted-foreground">
                        {formatPrice(product.price)} ליחידה
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <div className="rounded-2xl border border-border/70 bg-card/50 p-6">
            <h2 className="text-lg font-bold">סיכום הזמנה</h2>

            {missingForFreeShipping > 0 ? (
              <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-3">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Truck size={14} className="text-primary" />
                  עוד{" "}
                  <span className="ltr-nums font-bold text-foreground">
                    {formatPrice(missingForFreeShipping)}
                  </span>{" "}
                  ומשלוח חינם
                </p>
                <Progress value={(subtotal / FREE_SHIPPING_THRESHOLD) * 100} className="mt-2 h-1.5" />
              </div>
            ) : (
              <p className="mt-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs font-semibold text-primary">
                <Truck size={14} />
                המשלוח עלינו
              </p>
            )}

            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <dt>סכום ביניים</dt>
                <dd className="ltr-nums">{formatPrice(subtotal)}</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>משלוח</dt>
                <dd className="ltr-nums">{shipping === 0 ? "חינם" : formatPrice(shipping)}</dd>
              </div>
              <Separator className="my-3" />
              <div className="flex justify-between text-lg font-extrabold">
                <dt>סה״כ לתשלום</dt>
                <dd className="ltr-nums">{formatPrice(total)}</dd>
              </div>
            </dl>

            <Button asChild size="lg" className="mt-5 w-full gap-2 rounded-full text-base font-bold">
              <Link to={pageUrl("Checkout")}>
                למעבר לתשלום
                <ArrowLeft size={18} />
              </Link>
            </Button>

            <Link
              to={pageUrl("Shop")}
              className="mt-3 block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              המשך בקניות
            </Link>

            <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck size={13} className="text-primary" />
              תשלום מאובטח · 14 ימי החזרה
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
