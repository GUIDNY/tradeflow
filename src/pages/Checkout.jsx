import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  Mail,
  Smartphone,
  Store,
  Truck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import ProductArt from "@/components/store/ProductArt";
import { useCart } from "@/lib/CartContext";
import { formatPrice, FREE_SHIPPING_THRESHOLD, SHIPPING_COST } from "@/lib/products";
import { pageUrl } from "@/lib/nav";
import { cn } from "@/lib/utils";

const SHIPPING_METHODS = [
  {
    id: "standard",
    icon: Truck,
    title: "שליח עד הבית",
    text: "3–5 ימי עסקים",
    cost: (subtotal) => (subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST),
  },
  { id: "express", icon: Zap, title: "משלוח מהיר", text: "עד 24 שעות באזור המרכז", cost: () => 49 },
  { id: "pickup", icon: Store, title: "איסוף עצמי", text: "הארבעה 12, תל אביב", cost: () => 0 },
];

const PAYMENT_METHODS = [
  { id: "card", icon: CreditCard, title: "כרטיס אשראי", text: "ויזה, מאסטרקארד, אמריקן אקספרס" },
  { id: "bit", icon: Smartphone, title: "ביט", text: "נשלח אליכם בקשת תשלום" },
  { id: "transfer", icon: Building2, title: "העברה בנקאית", text: "לעסקים, כולל חשבונית מס" },
];

const digitsOnly = (value) => value.replace(/\D/g, "");

const validate = (form) => {
  const errors = {};
  if (form.fullName.trim().length < 2) errors.fullName = "נא למלא שם מלא";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) errors.email = "כתובת אימייל לא תקינה";
  if (digitsOnly(form.phone).length < 9) errors.phone = "מספר טלפון לא תקין";

  if (form.shippingMethod !== "pickup") {
    if (form.city.trim().length < 2) errors.city = "נא למלא יישוב";
    if (form.street.trim().length < 2) errors.street = "נא למלא רחוב";
    if (!form.houseNumber.trim()) errors.houseNumber = "נא למלא מספר בית";
  }

  if (form.paymentMethod === "card") {
    if (digitsOnly(form.cardNumber).length < 15) errors.cardNumber = "מספר כרטיס לא תקין";
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(form.cardExpiry)) errors.cardExpiry = "תוקף בפורמט MM/YY";
    if (digitsOnly(form.cardCvc).length < 3) errors.cardCvc = "קוד לא תקין";
    if (digitsOnly(form.cardId).length !== 9) errors.cardId = "ת״ז בת 9 ספרות";
  }

  return errors;
};

const Field = ({ id, label, error, className, children }) => (
  <div className={cn("space-y-1.5", className)}>
    <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">
      {label}
    </Label>
    {children}
    {error && <p className="text-xs font-medium text-destructive">{error}</p>}
  </div>
);

const OptionCard = ({ value, icon: Icon, title, text, price, selected }) => (
  <Label
    htmlFor={value}
    className={cn(
      "flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition",
      selected ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
    )}
  >
    <RadioGroupItem value={value} id={value} />
    <Icon size={19} className={selected ? "text-primary" : "text-muted-foreground"} />
    <span className="flex-1">
      <span className="block text-sm font-bold">{title}</span>
      <span className="block text-xs text-muted-foreground">{text}</span>
    </span>
    {price !== undefined && (
      <span className="ltr-nums text-sm font-bold">{price === 0 ? "חינם" : formatPrice(price)}</span>
    )}
  </Label>
);

export default function Checkout() {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    city: "",
    street: "",
    houseNumber: "",
    zip: "",
    notes: "",
    shippingMethod: "standard",
    paymentMethod: "card",
    cardNumber: "",
    cardExpiry: "",
    cardCvc: "",
    cardId: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [order, setOrder] = useState(null);

  const shippingCost = useMemo(
    () => SHIPPING_METHODS.find((m) => m.id === form.shippingMethod).cost(subtotal),
    [form.shippingMethod, subtotal]
  );
  const total = subtotal + shippingCost;

  const update = (key) => (event) => {
    const value = event?.target ? event.target.value : event;
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const firstField = document.getElementById(Object.keys(found)[0]);
      firstField?.scrollIntoView({ behavior: "smooth", block: "center" });
      firstField?.focus({ preventScroll: true });
      return;
    }

    setIsSubmitting(true);
    // Demo store: there is no payment processor behind this, so the order is
    // confirmed locally after a short delay.
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const reference = `TAP-${String(Date.now()).slice(-6)}`;
    setOrder({
      reference,
      total,
      email: form.email,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      isPickup: form.shippingMethod === "pickup",
    });
    clearCart();
    setIsSubmitting(false);

    try {
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.35 }, colors: ["#14d3c4", "#a78bfa", "#ffffff"] });
    } catch {
      // Confetti is decoration only.
    }
  };

  if (order) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <CheckCircle2 size={64} className="mx-auto text-primary" />
        <h1 className="mt-6 text-3xl font-black">ההזמנה נקלטה!</h1>
        <p className="mt-3 text-muted-foreground">
          שלחנו אישור לכתובת <span className="force-ltr font-semibold text-foreground">{order.email}</span>.
          {order.isPickup ? " נעדכן ברגע שההזמנה מוכנה לאיסוף." : " נעדכן אתכם ברגע שהחבילה יוצאת."}
        </p>

        <div className="mt-8 rounded-2xl border border-border/70 bg-card/50 p-6 text-start">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">מספר הזמנה</dt>
              <dd className="force-ltr font-bold text-primary">{order.reference}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">פריטים</dt>
              <dd className="ltr-nums font-semibold">{order.itemCount}</dd>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-extrabold">
              <dt>סה״כ שולם</dt>
              <dd className="ltr-nums">{formatPrice(order.total)}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="gap-2 rounded-full font-bold">
            <Link to={pageUrl("Shop")}>
              המשך בקניות
              <ArrowLeft size={18} />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full font-semibold">
            <Link to={pageUrl("Contact")}>יש לי שאלה על ההזמנה</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-5 px-4 py-28 text-center">
        <h1 className="text-3xl font-extrabold">אין מה לשלם עליו</h1>
        <p className="text-muted-foreground">העגלה ריקה — נוסיף מוצר ונחזור לכאן.</p>
        <Button onClick={() => navigate(pageUrl("Shop"))} className="rounded-full font-semibold">
          לחנות
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-3xl font-black">תשלום</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        חנות הדגמה — אל תזינו פרטי אשראי אמיתיים. שום פרט לא נשלח לשום מקום.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Contact */}
          <section className="rounded-2xl border border-border/70 bg-card/40 p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Mail size={17} className="text-primary" />
              פרטי התקשרות
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field id="fullName" label="שם מלא" error={errors.fullName}>
                <Input id="fullName" value={form.fullName} onChange={update("fullName")} placeholder="ישראל ישראלי" autoComplete="name" />
              </Field>
              <Field id="email" label="אימייל" error={errors.email}>
                <Input id="email" type="email" dir="ltr" value={form.email} onChange={update("email")} placeholder="you@example.com" autoComplete="email" />
              </Field>
              <Field id="phone" label="טלפון" error={errors.phone} className="sm:col-span-2">
                <Input id="phone" type="tel" dir="ltr" value={form.phone} onChange={update("phone")} placeholder="050-000-0000" autoComplete="tel" />
              </Field>
            </div>
          </section>

          {/* Shipping */}
          <section className="rounded-2xl border border-border/70 bg-card/40 p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Truck size={17} className="text-primary" />
              אופן המשלוח
            </h2>
            <RadioGroup value={form.shippingMethod} onValueChange={update("shippingMethod")} className="mt-5 gap-3">
              {SHIPPING_METHODS.map((method) => (
                <OptionCard
                  key={method.id}
                  value={method.id}
                  icon={method.icon}
                  title={method.title}
                  text={method.text}
                  price={method.cost(subtotal)}
                  selected={form.shippingMethod === method.id}
                />
              ))}
            </RadioGroup>

            {form.shippingMethod !== "pickup" && (
              <div className="mt-6 grid gap-4 sm:grid-cols-6">
                <Field id="city" label="יישוב" error={errors.city} className="sm:col-span-3">
                  <Input id="city" value={form.city} onChange={update("city")} placeholder="תל אביב" autoComplete="address-level2" />
                </Field>
                <Field id="street" label="רחוב" error={errors.street} className="sm:col-span-2">
                  <Input id="street" value={form.street} onChange={update("street")} placeholder="הרצל" autoComplete="address-line1" />
                </Field>
                <Field id="houseNumber" label="מספר" error={errors.houseNumber} className="sm:col-span-1">
                  <Input id="houseNumber" dir="ltr" value={form.houseNumber} onChange={update("houseNumber")} placeholder="14" />
                </Field>
                <Field id="zip" label="מיקוד (רשות)" className="sm:col-span-2">
                  <Input id="zip" dir="ltr" value={form.zip} onChange={update("zip")} placeholder="6120101" autoComplete="postal-code" />
                </Field>
                <Field id="notes" label="הערות לשליח (רשות)" className="sm:col-span-4">
                  <Textarea id="notes" value={form.notes} onChange={update("notes")} rows={1} placeholder="קומה, קוד כניסה, שעות נוחות…" />
                </Field>
              </div>
            )}
          </section>

          {/* Payment */}
          <section className="rounded-2xl border border-border/70 bg-card/40 p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Lock size={17} className="text-primary" />
              תשלום
            </h2>
            <RadioGroup value={form.paymentMethod} onValueChange={update("paymentMethod")} className="mt-5 gap-3">
              {PAYMENT_METHODS.map((method) => (
                <OptionCard
                  key={method.id}
                  value={method.id}
                  icon={method.icon}
                  title={method.title}
                  text={method.text}
                  selected={form.paymentMethod === method.id}
                />
              ))}
            </RadioGroup>

            {form.paymentMethod === "card" && (
              <div className="mt-6 grid gap-4 sm:grid-cols-6">
                <Field id="cardNumber" label="מספר כרטיס" error={errors.cardNumber} className="sm:col-span-3">
                  <Input id="cardNumber" dir="ltr" inputMode="numeric" value={form.cardNumber} onChange={update("cardNumber")} placeholder="4580 0000 0000 0000" />
                </Field>
                <Field id="cardExpiry" label="תוקף" error={errors.cardExpiry} className="sm:col-span-1">
                  <Input id="cardExpiry" dir="ltr" inputMode="numeric" value={form.cardExpiry} onChange={update("cardExpiry")} placeholder="09/28" />
                </Field>
                <Field id="cardCvc" label="CVV" error={errors.cardCvc} className="sm:col-span-1">
                  <Input id="cardCvc" dir="ltr" inputMode="numeric" value={form.cardCvc} onChange={update("cardCvc")} placeholder="123" />
                </Field>
                <Field id="cardId" label="ת״ז בעל הכרטיס" error={errors.cardId} className="sm:col-span-1">
                  <Input id="cardId" dir="ltr" inputMode="numeric" value={form.cardId} onChange={update("cardId")} placeholder="000000000" />
                </Field>
              </div>
            )}

            {form.paymentMethod === "bit" && (
              <p className="mt-5 rounded-xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                נשלח בקשת תשלום בביט למספר שהזנתם מיד לאחר אישור ההזמנה. ההזמנה נשמרת עד 30 דקות.
              </p>
            )}
            {form.paymentMethod === "transfer" && (
              <p className="mt-5 rounded-xl border border-border bg-secondary/40 p-4 text-sm leading-relaxed text-muted-foreground">
                פרטי החשבון וחשבונית עסקה יישלחו לאימייל. ההזמנה נכנסת לייצור עם קליטת ההעברה.
              </p>
            )}
          </section>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <div className="rounded-2xl border border-border/70 bg-card/50 p-6">
            <h2 className="text-lg font-bold">ההזמנה שלך</h2>

            <ul className="mt-4 space-y-3">
              {items.map(({ product, quantity, lineTotal }) => (
                <li key={product.id} className="flex items-center gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                    <ProductArt product={product} />
                    <span className="ltr-nums absolute -top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground ltr:-right-1 rtl:-left-1">
                      {quantity}
                    </span>
                  </div>
                  <span className="line-clamp-2 flex-1 text-xs font-semibold leading-snug">{product.name}</span>
                  <span className="ltr-nums text-sm font-bold">{formatPrice(lineTotal)}</span>
                </li>
              ))}
            </ul>

            <Separator className="my-4" />

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <dt>סכום ביניים</dt>
                <dd className="ltr-nums">{formatPrice(subtotal)}</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>משלוח</dt>
                <dd className="ltr-nums">{shippingCost === 0 ? "חינם" : formatPrice(shippingCost)}</dd>
              </div>
              <Separator className="my-3" />
              <div className="flex justify-between text-lg font-extrabold">
                <dt>סה״כ</dt>
                <dd className="ltr-nums">{formatPrice(total)}</dd>
              </div>
            </dl>

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="mt-5 w-full gap-2 rounded-full text-base font-bold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  מעבד…
                </>
              ) : (
                <>
                  <Lock size={17} />
                  אישור ותשלום
                </>
              )}
            </Button>

            <Link
              to={pageUrl("Cart")}
              className="mt-3 block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              חזרה לעגלה
            </Link>
          </div>
        </aside>
      </div>
    </form>
  );
}
