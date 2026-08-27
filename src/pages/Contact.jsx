import React, { useState } from "react";
import { CheckCircle2, Clock, Loader2, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const TOPICS = [
  { value: "order", label: "שאלה על הזמנה קיימת" },
  { value: "b2b", label: "הזמנה לעסק / כמות גדולה" },
  { value: "custom", label: "מיתוג והתאמה אישית" },
  { value: "support", label: "תמיכה טכנית בתג" },
  { value: "other", label: "משהו אחר" },
];

const CHANNELS = [
  { icon: Phone, title: "טלפון", value: "03-555-0142", note: "א׳–ה׳, 09:00–18:00" },
  { icon: MessageCircle, title: "וואטסאפ", value: "052-555-0142", note: "מענה גם בערב" },
  { icon: Mail, title: "אימייל", value: "hello@tapit.co.il", note: "תשובה תוך יום עסקים" },
  { icon: MapPin, title: "כתובת", value: "הארבעה 12, תל אביב", note: "איסוף עצמי בתיאום" },
];

const validate = (form) => {
  const errors = {};
  if (form.name.trim().length < 2) errors.name = "נא למלא שם";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) errors.email = "כתובת אימייל לא תקינה";
  if (form.message.trim().length < 10) errors.message = "כתבו לנו קצת יותר — לפחות 10 תווים";
  return errors;
};

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", topic: "order", message: "" });
  const [errors, setErrors] = useState({});
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

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
      document.getElementById(Object.keys(found)[0])?.focus();
      return;
    }
    setIsSending(true);
    // Demo store: the message is acknowledged locally, nothing leaves the browser.
    await new Promise((resolve) => setTimeout(resolve, 900));
    setIsSending(false);
    setSent(true);
  };

  return (
    <div>
      <section className="tap-glow border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-14">
          <h1 className="text-4xl font-black">דברו איתנו</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            שאלה על מוצר, הזמנה לעסק או בקשה למיתוג אישי — אנחנו עונים מהר וללא בוטים.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 lg:grid-cols-[1fr_380px]">
        <div className="rounded-2xl border border-border/70 bg-card/40 p-6 sm:p-8">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <CheckCircle2 size={56} className="text-primary" />
              <h2 className="text-2xl font-extrabold">ההודעה נשלחה</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                תודה {form.name.trim().split(" ")[0]}! נחזור אליכם לכתובת{" "}
                <span className="force-ltr font-semibold text-foreground">{form.email}</span> תוך יום עסקים.
              </p>
              <Button
                variant="outline"
                className="rounded-full font-semibold"
                onClick={() => {
                  setSent(false);
                  setForm({ name: "", email: "", phone: "", topic: "order", message: "" });
                }}
              >
                שליחת הודעה נוספת
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <h2 className="text-lg font-bold">טופס יצירת קשר</h2>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground">שם מלא</Label>
                  <Input id="name" value={form.name} onChange={update("name")} placeholder="ישראל ישראלי" />
                  {errors.name && <p className="text-xs font-medium text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground">אימייל</Label>
                  <Input id="email" type="email" dir="ltr" value={form.email} onChange={update("email")} placeholder="you@example.com" />
                  {errors.email && <p className="text-xs font-medium text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-semibold text-muted-foreground">טלפון (רשות)</Label>
                  <Input id="phone" type="tel" dir="ltr" value={form.phone} onChange={update("phone")} placeholder="050-000-0000" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">נושא הפנייה</Label>
                  <Select value={form.topic} onValueChange={update("topic")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TOPICS.map((topic) => (
                        <SelectItem key={topic.value} value={topic.value}>
                          {topic.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="message" className="text-xs font-semibold text-muted-foreground">ההודעה</Label>
                <Textarea
                  id="message"
                  rows={6}
                  value={form.message}
                  onChange={update("message")}
                  placeholder="ספרו לנו על העסק ומה אתם מחפשים…"
                />
                {errors.message && <p className="text-xs font-medium text-destructive">{errors.message}</p>}
              </div>

              <Button type="submit" size="lg" disabled={isSending} className="w-full gap-2 rounded-full text-base font-bold sm:w-auto sm:px-10">
                {isSending ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    שולח…
                  </>
                ) : (
                  <>
                    <Send size={17} className="rtl:-scale-x-100" />
                    שליחה
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                חנות הדגמה — ההודעה לא נשלחת לשרת ולא נשמרת בשום מקום.
              </p>
            </form>
          )}
        </div>

        <aside className="space-y-4">
          {CHANNELS.map(({ icon: Icon, title, value, note }) => (
            <div key={title} className="flex gap-4 rounded-2xl border border-border/70 bg-card/40 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                <Icon size={19} />
              </span>
              <div>
                <p className="text-sm font-bold">{title}</p>
                <p className={cn("mt-0.5 text-sm text-foreground", title !== "כתובת" && "force-ltr")}>{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{note}</p>
              </div>
            </div>
          ))}

          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
            <Clock size={19} className="text-primary" />
            <p className="mt-3 text-sm font-bold">הזמנות לעסקים</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              מעל 50 יחידות? יש מחירון ייעודי, הדמיית מיתוג לפני ייצור וליווי הקמה לכל הצוות. סמנו "הזמנה לעסק"
              בטופס ונחזור עם הצעה תוך יום עסקים.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
