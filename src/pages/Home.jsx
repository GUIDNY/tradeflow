import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  Cpu,
  CreditCard,
  Package,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Sticker,
  Store,
  Truck,
  Watch,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/store/ProductCard";
import { CATEGORIES, PRODUCTS, formatPrice } from "@/lib/products";
import { pageUrl, shopUrl } from "@/lib/nav";

const CATEGORY_ICONS = { CreditCard, Store, Sticker, Watch, Cpu, Package };

const VALUE_PROPS = [
  { icon: Zap, title: "בלי אפליקציה", text: "כל טלפון מ־2018 ומעלה קורא את התג בקירוב אחד." },
  { icon: RefreshCw, title: "עדכון בלי הדפסה", text: "משנים תפקיד או מספר? מעדכנים בפאנל, הכרטיס נשאר." },
  { icon: Truck, title: "משלוח מהיר", text: "3–5 ימי עסקים לכל הארץ, חינם מעל 250 ₪." },
  { icon: ShieldCheck, title: "אחריות שנתיים", text: "השבב לא נגמר, לא נטען ולא מתקלקל. וגם אם כן — נחליף." },
];

const STEPS = [
  {
    icon: Package,
    title: "בוחרים מוצר",
    text: "כרטיס מתכת, מעמד ביקורות, מדבקה או טבעת — כל מוצר מגיע עם שבב מתוכנת מראש.",
  },
  {
    icon: Smartphone,
    title: "מחברים לפרופיל",
    text: "סורקים פעם אחת, ממלאים פרטים, מוסיפים לינקים לרשתות, לוואטסאפ ולתשלום. שתי דקות.",
  },
  {
    icon: Sparkles,
    title: "מקרבים ומרשימים",
    text: "מכאן זה קורה מעצמו: מקרבים לטלפון של מישהו, הפרופיל נפתח והפרטים נשמרים אצלו.",
  },
];

const STATS = [
  { value: "×4", label: "יותר ביקורות גוגל בממוצע לעסק" },
  { value: "0.4", label: "שניות מהקירוב ועד פתיחת הפרופיל" },
  { value: "100K", label: "כתיבות מחדש לכל שבב" },
  { value: "12,400", label: "לקוחות שכבר עשו את המעבר" },
];

const TESTIMONIALS = [
  {
    name: "נועה ברקוביץ'",
    role: "בעלים, סטודיו נועה",
    text: "המעמד ביקורות שינה לנו את החודש. עברנו מ־3 ביקורות בממוצע ל־19, בלי לבקש מאף אחד באופן אקטיבי.",
  },
  {
    name: "עידו מזרחי",
    role: "מנהל מכירות, Fieldly",
    text: "הזמנו חבילת צוות של עשרה כרטיסים לפני כנס. אנשים ביקשו לראות את הכרטיס עוד לפני ששמעו מה אנחנו מוכרים.",
  },
  {
    name: "רותם אלוני",
    role: "אדריכלית",
    text: "הכרטיס מהעץ מדויק לשפה שלי. הגיע ארוז יפה, עבד מהשנייה הראשונה, ואני מעדכנת אותו מהטלפון.",
  },
];

const HeroVisual = () => (
  <div className="relative mx-auto aspect-square w-full max-w-md">
    <div className="absolute inset-6 rounded-full bg-primary/20 blur-3xl" />
    <div className="absolute inset-0 grid place-items-center">
      {[0, 1, 2].map((ring) => (
        <span
          key={ring}
          style={{ animationDelay: `${ring * 0.45}s`, inset: `${ring * 14}%` }}
          className="animate-tap-pulse absolute rounded-full border border-primary/40"
        />
      ))}
    </div>
    <div className="animate-tap-float absolute inset-0 grid place-items-center">
      <div className="w-64 -rotate-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-[0_30px_80px_-30px] shadow-primary/60">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-extrabold">דנה לוי</p>
            <p className="text-xs text-muted-foreground">מנהלת מוצר · Northwind</p>
          </div>
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-primary" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M8 8a6 6 0 0 1 0 8" />
            <path d="M13 5a11 11 0 0 1 0 14" opacity="0.7" />
            <path d="M18 2.5a16 16 0 0 1 0 19" opacity="0.4" />
          </svg>
        </div>
        <div className="mt-6 space-y-2">
          <div className="h-2 w-4/5 rounded-full bg-white/15" />
          <div className="h-2 w-3/5 rounded-full bg-white/10" />
        </div>
        <div className="mt-6 flex gap-2">
          {["וואטסאפ", "לינקדאין", "אתר"].map((chip) => (
            <span key={chip} className="rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-semibold text-primary">
              {chip}
            </span>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default function Home() {
  const bestsellers = PRODUCTS.filter((p) => p.bestseller || p.isNew).slice(0, 4);
  const deals = PRODUCTS.filter((p) => p.compareAt).slice(0, 4);

  return (
    <div>
      {/* Hero */}
      <section className="tap-glow relative overflow-hidden border-b border-border/60">
        <div className="tap-grid absolute inset-0 opacity-60" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <Sparkles size={13} />
              חדש: ערכת סטארטר לעסק — חיסכון של 147 ₪
            </span>
            <h1 className="mt-5 text-4xl font-black leading-[1.15] sm:text-5xl lg:text-6xl">
              טאפ אחד.
              <br />
              <span className="text-gradient">וכל מה שאתם</span> עובר.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
              כרטיסי ביקור חכמים, מעמדי ביקורות, מדבקות ותגים עם שבב NFC. בלי אפליקציה, בלי הדפסה מחדש,
              בלי חפיסות כרטיסים שנשארות במגירה.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="gap-2 rounded-full px-7 text-base font-bold">
                <Link to={pageUrl("Shop")}>
                  לחנות
                  <ArrowLeft size={18} />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-7 text-base font-semibold">
                <Link to={pageUrl("HowItWorks")}>איך זה עובד?</Link>
              </Button>
            </div>

            <dl className="mt-10 grid max-w-lg grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <dt className="force-ltr text-2xl font-extrabold text-primary">{stat.value}</dt>
                  <dd className="mt-1 text-xs leading-snug text-muted-foreground">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <HeroVisual />
        </div>
      </section>

      {/* Value props */}
      <section className="border-b border-border/60 bg-card/20">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {VALUE_PROPS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                <Icon size={18} />
              </span>
              <div>
                <p className="text-sm font-bold">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold">מה מחפשים היום?</h2>
            <p className="mt-2 text-muted-foreground">שש משפחות מוצרים, שבב אחד שמחבר ביניהן.</p>
          </div>
          <Button asChild variant="ghost" className="gap-1.5 rounded-full font-semibold text-primary">
            <Link to={pageUrl("Shop")}>
              כל המוצרים
              <ArrowLeft size={16} />
            </Link>
          </Button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((category) => {
            const Icon = CATEGORY_ICONS[category.icon] || CreditCard;
            const count = PRODUCTS.filter((p) => p.category === category.id).length;
            return (
              <Link
                key={category.id}
                to={shopUrl({ category: category.id })}
                className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card/50 p-6 transition hover:-translate-y-1 hover:border-primary/50"
              >
                <span className="absolute -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl transition group-hover:bg-primary/20 ltr:-right-10 rtl:-left-10" />
                <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary/25 to-accent/25 text-primary">
                  <Icon size={20} />
                </span>
                <h3 className="relative mt-4 text-lg font-bold">{category.name}</h3>
                <p className="relative mt-1 text-sm text-muted-foreground">{category.tagline}</p>
                <p className="ltr-nums relative mt-4 text-xs font-semibold text-primary">{count} מוצרים ←</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Bestsellers */}
      <section className="border-y border-border/60 bg-card/20">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-extrabold">הכי נמכרים החודש</h2>
              <p className="mt-2 text-muted-foreground">המוצרים שלקוחות חוזרים להזמין שוב לכל הצוות.</p>
            </div>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {bestsellers.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-center text-3xl font-extrabold">שלושה צעדים, בערך חמש דקות</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          אין התקנה, אין הגדרות מסובכות ואין צורך שהצד השני יוריד משהו.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <div key={title} className="relative rounded-2xl border border-border/70 bg-card/40 p-7">
              <span className="ltr-nums absolute -top-4 grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground ltr:left-7 rtl:right-7">
                {index + 1}
              </span>
              <Icon size={26} className="mt-2 text-primary" />
              <h3 className="mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Deals */}
      <section className="border-y border-border/60 bg-card/20">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-extrabold">במבצע עכשיו</h2>
              <p className="mt-2 text-muted-foreground">מלאי מוגבל, המחיר חוזר לעצמו בסוף החודש.</p>
            </div>
            <Button asChild variant="outline" className="rounded-full font-semibold">
              <Link to={shopUrl({ sort: "discount" })}>כל המבצעים</Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {deals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-3xl font-extrabold">מה אומרים אצלנו בלקוחות</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((item) => (
            <figure key={item.name} className="rounded-2xl border border-border/70 bg-card/40 p-6">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} size={15} className="fill-amber-400 text-amber-400" />
                ))}
              </div>
              <blockquote className="mt-4 text-sm leading-relaxed text-muted-foreground">"{item.text}"</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-primary/30 to-accent/30 text-sm font-bold">
                  {item.name.charAt(0)}
                </span>
                <span>
                  <span className="block text-sm font-bold">{item.name}</span>
                  <span className="block text-xs text-muted-foreground">{item.role}</span>
                </span>
                <BadgeCheck size={16} className="text-primary ms-auto" />
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-4">
        <div className="tap-glow relative overflow-hidden rounded-3xl border border-primary/25 p-10 text-center sm:p-16">
          <div className="tap-grid absolute inset-0 opacity-50" />
          <div className="relative">
            <h2 className="text-3xl font-extrabold sm:text-4xl">מוכנים להפסיק להדפיס כרטיסים?</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              ערכת הסטארטר מכניסה עסק שלם לעולם ה־NFC ביום אחד — כרטיסים, מעמד ביקורות, תג WiFi ומדבקות,
              הכול מתוכנת מראש.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="gap-2 rounded-full px-8 text-base font-bold">
                <Link to={pageUrl("Shop")}>
                  להתחיל לקנות
                  <ArrowLeft size={18} />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-8 text-base font-semibold">
                <Link to={pageUrl("Contact")}>לדבר עם מומחה</Link>
              </Button>
            </div>
            <p className="ltr-nums mt-6 text-xs text-muted-foreground">
              ערכת סטארטר · {formatPrice(399)} במקום {formatPrice(546)}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
