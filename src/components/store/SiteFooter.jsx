import React from "react";
import { Link } from "react-router-dom";
import { Instagram, Linkedin, Mail, MessageCircle, Phone } from "lucide-react";
import { Wordmark } from "./SiteHeader";
import { CATEGORIES } from "@/lib/products";
import { pageUrl, shopUrl } from "@/lib/nav";

const SUPPORT = [
  { label: "איך זה עובד", to: pageUrl("HowItWorks") },
  { label: "צור קשר", to: pageUrl("Contact") },
  { label: "משלוחים והחזרות", to: pageUrl("HowItWorks") + "#shipping" },
  { label: "שאלות נפוצות", to: pageUrl("HowItWorks") + "#faq" },
];

export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/70 bg-card/30">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4">
        <div className="md:col-span-1">
          <Wordmark />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            מוצרי NFC לעסקים ולאנשים שאוהבים שדברים פשוט עובדים. מתכננים, מייצרים ומתכנתים בישראל.
          </p>
          <div className="mt-5 flex gap-2">
            {[
              { Icon: Instagram, label: "אינסטגרם" },
              { Icon: Linkedin, label: "לינקדאין" },
              { Icon: MessageCircle, label: "וואטסאפ" },
            ].map(({ Icon, label }) => (
              <span
                key={label}
                aria-label={label}
                className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition hover:border-primary/60 hover:text-primary"
              >
                <Icon size={16} />
              </span>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold">קטגוריות</h3>
          <ul className="mt-4 space-y-2.5">
            {CATEGORIES.map((category) => (
              <li key={category.id}>
                <Link
                  to={shopUrl({ category: category.id })}
                  className="text-sm text-muted-foreground transition hover:text-primary"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold">שירות לקוחות</h3>
          <ul className="mt-4 space-y-2.5">
            {SUPPORT.map((link) => (
              <li key={link.label}>
                <Link to={link.to} className="text-sm text-muted-foreground transition hover:text-primary">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold">דברו איתנו</h3>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Phone size={15} className="text-primary" />
              <span className="force-ltr">03-555-0142</span>
            </li>
            <li className="flex items-center gap-2">
              <Mail size={15} className="text-primary" />
              <span className="force-ltr">hello@tapit.co.il</span>
            </li>
            <li className="text-xs leading-relaxed">
              ימים א׳–ה׳, 09:00–18:00
              <br />
              מענה בוואטסאפ גם אחרי השעות
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} TapIt · כל הזכויות שמורות</p>
          <p>המחירים כוללים מע״מ · תשלום מאובטח · חנות הדגמה</p>
        </div>
      </div>
    </footer>
  );
}
