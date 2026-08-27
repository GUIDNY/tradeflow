import React from "react";
import { Link } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import ProductArt from "./ProductArt";
import StarRating from "./StarRating";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/products";
import { productUrl } from "@/lib/nav";
import { useCart } from "@/lib/CartContext";
import { cn } from "@/lib/utils";

export default function ProductCard({ product, className }) {
  const { addItem } = useCart();

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/60 transition duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_20px_60px_-30px] hover:shadow-primary/60",
        className
      )}
    >
      <Link to={productUrl(product.id)} className="relative block aspect-[4/3] overflow-hidden">
        <ProductArt product={product} className="transition duration-500 group-hover:scale-105" />
        {product.badge && (
          <span className="absolute top-3 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground shadow-lg ltr:left-3 rtl:right-3">
            {product.badge}
          </span>
        )}
        {product.compareAt && (
          <span className="force-ltr absolute top-3 rounded-full bg-rose-500/90 px-2.5 py-1 text-[11px] font-bold text-white ltr:right-3 rtl:left-3">
            -{Math.round((1 - product.price / product.compareAt) * 100)}%
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <StarRating value={product.rating} reviews={product.reviews} />
        <Link to={productUrl(product.id)} className="text-base font-bold leading-tight hover:text-primary">
          {product.name}
        </Link>
        <p className="line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">{product.short}</p>

        <div className="flex items-end justify-between gap-3 pt-1">
          <div className="flex items-baseline gap-2">
            <span className="ltr-nums text-xl font-extrabold">{formatPrice(product.price)}</span>
            {product.compareAt && (
              <span className="ltr-nums text-sm text-muted-foreground line-through">
                {formatPrice(product.compareAt)}
              </span>
            )}
          </div>
          <Button
            size="sm"
            className="gap-1.5 rounded-full font-semibold"
            onClick={() => addItem(product.id, 1)}
          >
            <ShoppingBag size={15} />
            הוספה
          </Button>
        </div>
      </div>
    </div>
  );
}
