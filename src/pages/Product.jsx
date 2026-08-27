import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  CreditCard,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductArt from "@/components/store/ProductArt";
import ProductCard from "@/components/store/ProductCard";
import StarRating from "@/components/store/StarRating";
import QuantityStepper from "@/components/store/QuantityStepper";
import { useCart } from "@/lib/CartContext";
import { getCategory, getProduct, getRelated, formatPrice, FREE_SHIPPING_THRESHOLD } from "@/lib/products";
import { pageUrl, shopUrl } from "@/lib/nav";

const GUARANTEES = [
  { icon: Truck, title: "משלוח 3–5 ימי עסקים", text: `חינם מעל ${FREE_SHIPPING_THRESHOLD} ₪` },
  { icon: RefreshCw, title: "14 ימי החזרה", text: "גם אם פשוט התחרטתם" },
  { icon: ShieldCheck, title: "אחריות יצרן", text: "על השבב ועל הגוף" },
  { icon: PackageCheck, title: "מתוכנת מראש", text: "מגיע מוכן לעבודה" },
];

export default function Product() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);

  const product = getProduct(searchParams.get("id"));

  if (!product) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-4 py-28 text-center">
        <h1 className="text-3xl font-extrabold">המוצר לא נמצא</h1>
        <p className="text-muted-foreground">ייתכן שהקישור ישן, או שהמוצר ירד מהמדף.</p>
        <Button asChild className="rounded-full font-semibold">
          <Link to={pageUrl("Shop")}>חזרה לחנות</Link>
        </Button>
      </div>
    );
  }

  const category = getCategory(product.category);
  const related = getRelated(product, 4);
  const lowStock = product.stock <= 40;

  const buyNow = () => {
    addItem(product.id, quantity);
    navigate(pageUrl("Checkout"));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link to={pageUrl("Home")} className="hover:text-foreground">בית</Link>
        <ChevronLeft size={13} className="rtl:rotate-180" />
        <Link to={pageUrl("Shop")} className="hover:text-foreground">חנות</Link>
        <ChevronLeft size={13} className="rtl:rotate-180" />
        <Link to={shopUrl({ category: product.category })} className="hover:text-foreground">
          {category?.name}
        </Link>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div>
          <div className="overflow-hidden rounded-3xl border border-border/70">
            <div className="aspect-[4/3]">
              <ProductArt product={product} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-3">
            {GUARANTEES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl border border-border/60 bg-card/40 p-3 text-center">
                <Icon size={17} className="mx-auto text-primary" />
                <p className="mt-2 text-[11px] font-bold leading-tight">{title}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            {product.badge && <Badge className="rounded-full font-bold">{product.badge}</Badge>}
            <Badge variant="secondary" className="rounded-full font-normal">{category?.name}</Badge>
          </div>

          <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">{product.name}</h1>
          <StarRating value={product.rating} reviews={product.reviews} size={16} className="mt-3" />
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">{product.short}</p>

          <div className="mt-6 flex items-baseline gap-3">
            <span className="ltr-nums text-4xl font-black">{formatPrice(product.price)}</span>
            {product.compareAt && (
              <>
                <span className="ltr-nums text-lg text-muted-foreground line-through">
                  {formatPrice(product.compareAt)}
                </span>
                <Badge className="ltr-nums rounded-full bg-rose-500 font-bold text-white hover:bg-rose-500">
                  חיסכון {formatPrice(product.compareAt - product.price)}
                </Badge>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">המחיר כולל מע״מ</p>

          <ul className="mt-6 space-y-2.5">
            {product.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm">
                <Check size={16} className="mt-0.5 shrink-0 text-primary" />
                <span className="text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>

          <Separator className="my-6" />

          <div className="flex flex-wrap items-center gap-3">
            <QuantityStepper value={quantity} onChange={setQuantity} max={Math.min(20, product.stock)} />
            <Button
              size="lg"
              onClick={() => addItem(product.id, quantity)}
              className="h-12 flex-1 gap-2 rounded-full text-base font-bold"
            >
              <ShoppingBag size={18} />
              הוספה לעגלה
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={buyNow}
              className="h-12 gap-2 rounded-full px-6 text-base font-semibold"
            >
              <CreditCard size={18} />
              קנייה מהירה
            </Button>
          </div>

          <p className="ltr-nums mt-4 text-xs">
            {lowStock ? (
              <span className="font-semibold text-amber-400">נותרו {product.stock} יחידות במלאי</span>
            ) : (
              <span className="text-muted-foreground">במלאי · נשלח היום אם מזמינים עד 14:00</span>
            )}
          </p>

          <Tabs defaultValue="description" className="mt-8">
            <TabsList className="w-full justify-start rounded-full bg-secondary/60">
              <TabsTrigger value="description" className="rounded-full">תיאור</TabsTrigger>
              <TabsTrigger value="specs" className="rounded-full">מפרט</TabsTrigger>
              <TabsTrigger value="shipping" className="rounded-full">משלוח והחזרות</TabsTrigger>
            </TabsList>
            <TabsContent value="description" className="pt-5 text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </TabsContent>
            <TabsContent value="specs" className="pt-5">
              <dl className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60">
                {Object.entries(product.specs).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-4 px-4 py-3 text-sm">
                    <dt className="text-muted-foreground">{key}</dt>
                    <dd className="ltr-nums font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
            </TabsContent>
            <TabsContent value="shipping" className="space-y-3 pt-5 text-sm leading-relaxed text-muted-foreground">
              <p>
                שליח עד הבית תוך 3–5 ימי עסקים, או איסוף עצמי מתל אביב תוך 24 שעות. משלוח חינם בהזמנה מעל{" "}
                <span className="ltr-nums font-semibold text-foreground">{formatPrice(FREE_SHIPPING_THRESHOLD)}</span>.
              </p>
              <p>
                מוצרים שאינם מותאמים אישית ניתן להחזיר תוך 14 יום באריזה המקורית. מוצרים עם חריטה או הדפסת לוגו
                מיוצרים לפי הזמנה ולכן לא ניתנים להחזרה — אבל אם הגיע פגם, נחליף מיד.
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <section className="mt-20">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-extrabold">משלימים את ההזמנה</h2>
          <Button asChild variant="ghost" className="gap-1.5 rounded-full font-semibold text-primary">
            <Link to={pageUrl("Shop")}>
              לכל המוצרים
              <ArrowLeft size={16} />
            </Link>
          </Button>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((item) => (
            <ProductCard key={item.id} product={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
