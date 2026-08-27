import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ProductCard from "@/components/store/ProductCard";
import { CATEGORIES, PRODUCTS, formatPrice } from "@/lib/products";

const SORTS = [
  { value: "popular", label: "הכי פופולריים" },
  { value: "price-asc", label: "מחיר: מהנמוך לגבוה" },
  { value: "price-desc", label: "מחיר: מהגבוה לנמוך" },
  { value: "rating", label: "דירוג לקוחות" },
  { value: "discount", label: "אחוז ההנחה" },
];

const MAX_PRICE = Math.max(...PRODUCTS.map((p) => p.price));

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") || "all";
  const sort = searchParams.get("sort") || "popular";

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE);
  const [showFilters, setShowFilters] = useState(false);

  // Keep the URL in sync so a search can be shared or bookmarked.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (query) next.set("q", query);
      else next.delete("q");
      if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  };

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = PRODUCTS.filter((product) => {
      if (category !== "all" && product.category !== category) return false;
      if (product.price > maxPrice) return false;
      if (!normalized) return true;
      return (
        product.name.toLowerCase().includes(normalized) ||
        product.short.toLowerCase().includes(normalized) ||
        product.description.toLowerCase().includes(normalized)
      );
    });

    const discount = (p) => (p.compareAt ? 1 - p.price / p.compareAt : 0);
    const sorters = {
      "price-asc": (a, b) => a.price - b.price,
      "price-desc": (a, b) => b.price - a.price,
      rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
      discount: (a, b) => discount(b) - discount(a),
      popular: (a, b) => Number(!!b.bestseller) - Number(!!a.bestseller) || b.reviews - a.reviews,
    };
    return [...filtered].sort(sorters[sort] || sorters.popular);
  }, [category, sort, query, maxPrice]);

  const hasFilters = category !== "all" || query !== "" || maxPrice < MAX_PRICE;

  const clearAll = () => {
    setQuery("");
    setMaxPrice(MAX_PRICE);
    setSearchParams(new URLSearchParams());
  };

  return (
    <div>
      <div className="tap-glow border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <h1 className="text-4xl font-black">החנות</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            כל מוצרי ה־NFC שלנו במקום אחד — מכרטיס PVC ב־89 ₪ ועד ערכות שלמות לעסק.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Category pills */}
        <div className="-mx-1 flex gap-2 overflow-x-auto pb-2">
          {[{ id: "all", name: "הכול" }, ...CATEGORIES].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setParam("category", item.id)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                category === item.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute top-1/2 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="חיפוש מוצר, למשל: מדבקה, טבעת, ביקורות…"
              className="h-11 rounded-full bg-card/60 ps-10 pe-10"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="ניקוי חיפוש"
                className="absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground ltr:right-3 rtl:left-3"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <Select value={sort} onValueChange={(value) => setParam("sort", value)}>
            <SelectTrigger className="h-11 w-[190px] rounded-full bg-card/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => setShowFilters((open) => !open)}
            className="h-11 gap-2 rounded-full font-semibold"
          >
            <SlidersHorizontal size={16} />
            מחיר
          </Button>

          {hasFilters && (
            <Button variant="ghost" onClick={clearAll} className="h-11 gap-1.5 rounded-full text-muted-foreground">
              <X size={15} />
              ניקוי סינון
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="mt-4 rounded-2xl border border-border/70 bg-card/50 p-5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">מחיר מקסימלי</label>
              <span className="ltr-nums text-sm font-bold text-primary">{formatPrice(maxPrice)}</span>
            </div>
            <Slider
              value={[maxPrice]}
              min={30}
              max={MAX_PRICE}
              step={10}
              onValueChange={([value]) => setMaxPrice(value)}
              className="mt-4"
              dir="rtl"
            />
          </div>
        )}

        <p className="ltr-nums mt-6 text-sm text-muted-foreground">
          {results.length} מוצרים
          {category !== "all" && (
            <Badge variant="secondary" className="ms-2 rounded-full font-normal">
              {CATEGORIES.find((c) => c.id === category)?.name}
            </Badge>
          )}
        </p>

        {results.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-4 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-secondary">
              <Search size={24} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-bold">לא מצאנו מוצר שמתאים</p>
              <p className="mt-1 text-sm text-muted-foreground">נסו מונח אחר, או הסירו את הסינון.</p>
            </div>
            <Button onClick={clearAll} className="rounded-full font-semibold">
              הצגת כל המוצרים
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
