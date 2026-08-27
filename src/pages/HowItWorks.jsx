import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Battery,
  CheckCircle2,
  CreditCard,
  Nfc,
  QrCode,
  RefreshCw,
  Scan,
  Smartphone,
  Store,
  Truck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { pageUrl } from "@/lib/nav";
import { FREE_SHIPPING_THRESHOLD, formatPrice } from "@/lib/products";

const STEPS = [
  {
    icon: Scan,
    title: "השבב יושב בתוך המוצר",
    text: "שבב NFC פסיבי בגודל בול, בלי סוללה ובלי חלקים נעים. הוא ניזון מהשדה המגנטי של הטלפון עצמו — ולכן עובד גם עשור קדימה.",
  },
  {
    icon: Smartphone,
    title: "הטלפון מזהה בקירוב",
    text: "כל אייפון מ־XS ומעלה וכל אנדרואיד עם NFC קוראים את התג ישירות ממסך הנעילה. אין אפליקציה להוריד ואין הרשאות לאשר.",
  },
  {
    icon: RefreshCw,
    title: "התוכן מתעדכן, המוצר נשאר",
    text: "השבב מפנה לכתובת קבועה שאתם שולטים בה. מחליפים תפקיד, מספר או מבצע — והכרטיס שכבר חילקתם מציג את המידע החדש.",
  },
];

const AUDIENCES = [
  {
    icon: Users,
    title: "אנשי מכירות וצוותים",
    text: "כרטיס אחד לכל נציג, פאנל ניהול אחד לכל הצוות, ועדכון גורף כשמשנים לוגו או כתובת.",
  },
  {
    icon: Store,
    title: "בעלי עסקים פיזיים",
    text: "מעמד ביקורות בדלפק, תפריט דיגיטלי בשולחן ותג WiFi לאורחים — שלושה מוצרים ששינו את חוויית הלקוח.",
  },
  {
    icon: CreditCard,
    title: "פרילנסרים ויוצרים",
    text: "כרטיס ביקור שאי אפשר לאבד, עם קישור לתיק עבודות, לוואטסאפ ולתשלום — הכול במסך אחד.",
  },
];

const FAQ = [
  {
    q: "האם צריך אפליקציה כדי לקרוא את התג?",
    a: "לא. אייפון מ־XS ומעלה ורוב מכשירי האנדרואיד מ־2018 קוראים תגי NFC ישירות ממסך הנעילה. גם לצד שמקבל את הכרטיס לא צריך שום דבר מותקן.",
  },
  {
    q: "מה קורה אם לטלפון של הלקוח אין NFC?",
    a: "כל מוצר מגיע גם עם קוד QR מגובה. הלקוח סורק במצלמה ומגיע בדיוק לאותו מקום.",
  },
  {
    q: "אפשר לשנות את הקישור אחרי שהזמנתי?",
    a: "כן, בכל רגע וללא הגבלה. השבב מפנה לכתובת קבועה שלכם, ואת התוכן שמאחוריה אתם עורכים מהפאנל מתי שתרצו.",
  },
  {
    q: "כמה זמן השבב מחזיק?",
    a: "אין סוללה, ולכן אין מה שיתרוקן. השבבים מדורגים לכ־100,000 כתיבות ולקריאות בלתי מוגבלות. האחריות שלנו היא לשנתיים.",
  },
  {
    q: "האם אפשר להזמין עם לוגו של החברה?",
    a: "בהחלט. חריטת לייזר על מוצרי מתכת ועץ, והדפסת UV מלאה על PVC ואקריל. שלחו לנו קובץ וקטורי ונחזור עם הדמיה לפני ייצור.",
  },
  {
    q: "מה זמני האספקה להזמנה מותאמת אישית?",
    a: "מוצרי מדף נשלחים תוך 3–5 ימי עסקים. מוצרים עם מיתוג אישי מיוצרים תוך 5–7 ימי עסקים ואז נשלחים.",
  },
];

export default function HowItWorks() {
  return (
    <div>
      <section className="tap-glow relative overflow-hidden border-b border-border/60">
        <div className="tap-grid absolute inset-0 opacity-60" />
        <div className="relative mx-auto max-w-3xl px-4 py-16 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            <Nfc size={14} />
            הסבר בגובה העיניים
          </span>
          <h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">איך NFC באמת עובד?</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            אותה טכנולוגיה שמאפשרת לכם לשלם עם הטלפון בקופה — רק שבמקום לחייב אתכם, היא
            פותחת את הפרופיל הדיגיטלי שלכם אצל מי שמולכם.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <div key={title} className="relative rounded-2xl border border-border/70 bg-card/40 p-7">
              <span className="ltr-nums absolute -top-4 grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground ltr:left-7 rtl:right-7">
                {index + 1}
              </span>
              <Icon size={26} className="mt-2 text-primary" />
              <h2 className="mt-4 text-lg font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Battery, title: "בלי סוללה", text: "השבב פסיבי — הטלפון מספק את האנרגיה" },
            { icon: QrCode, title: "גיבוי QR", text: "לכל מוצר יש גם קוד סריקה רגיל" },
            { icon: CheckCircle2, title: "בלי אפליקציה", text: "עובד ישירות ממסך הנעילה" },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/30 p-4">
              <Icon size={20} className="text-primary" />
              <div>
                <p className="text-sm font-bold">{title}</p>
                <p className="text-xs text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border/60 bg-card/20">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <h2 className="text-3xl font-extrabold">למי זה מתאים</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {AUDIENCES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-border/70 bg-card/40 p-6">
                <Icon size={24} className="text-primary" />
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="shipping" className="mx-auto max-w-7xl scroll-mt-32 px-4 py-16">
        <h2 className="text-3xl font-extrabold">משלוחים והחזרות</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-card/40 p-6">
            <Truck size={22} className="text-primary" />
            <h3 className="mt-4 text-lg font-bold">משלוחים</h3>
            <ul className="mt-3 list-disc space-y-2 ps-5 text-sm text-muted-foreground marker:text-primary">
              <li>שליח עד הבית: 3–5 ימי עסקים</li>
              <li>משלוח מהיר במרכז: עד 24 שעות, 49 ₪</li>
              <li>איסוף עצמי מתל אביב: תוך 24 שעות, ללא עלות</li>
              <li>
                משלוח חינם בהזמנה מעל{" "}
                <span className="ltr-nums font-semibold text-foreground">
                  {formatPrice(FREE_SHIPPING_THRESHOLD)}
                </span>
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card/40 p-6">
            <RefreshCw size={22} className="text-primary" />
            <h3 className="mt-4 text-lg font-bold">החזרות</h3>
            <ul className="mt-3 list-disc space-y-2 ps-5 text-sm text-muted-foreground marker:text-primary">
              <li>14 ימי החזרה על מוצרי מדף באריזה מקורית</li>
              <li>מוצרים עם חריטה או הדפסה אישית אינם ניתנים להחזרה</li>
              <li>פגם בייצור? החלפה מלאה על חשבוננו</li>
              <li>אחריות יצרן לשנתיים על השבב ועל הגוף</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl scroll-mt-32 px-4 pb-16">
        <h2 className="text-3xl font-extrabold">שאלות נפוצות</h2>
        <Accordion type="single" collapsible className="mt-6">
          {FAQ.map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger className="text-start text-base font-bold hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-4">
        <div className="tap-glow relative overflow-hidden rounded-3xl border border-primary/25 p-10 text-center">
          <h2 className="text-3xl font-extrabold">עדיין מתלבטים איזה מוצר מתאים?</h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            ספרו לנו מה העסק שלכם עושה ונמליץ על ההרכב הנכון — בלי מכירה אגרסיבית.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="gap-2 rounded-full px-8 font-bold">
              <Link to={pageUrl("Shop")}>
                לחנות
                <ArrowLeft size={18} />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-8 font-semibold">
              <Link to={pageUrl("Contact")}>לשאול שאלה</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
