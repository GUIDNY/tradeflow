import React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function QuantityStepper({ value, onChange, min = 1, max = 99, className }) {
  const set = (next) => onChange(Math.max(min, Math.min(max, next)));

  return (
    <div className={cn("inline-flex items-center rounded-full border border-border bg-secondary/60", className)}>
      <button
        type="button"
        onClick={() => set(value - 1)}
        disabled={value <= min}
        aria-label="הפחתת כמות"
        className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:text-foreground disabled:opacity-30"
      >
        <Minus size={15} />
      </button>
      <span className="ltr-nums w-9 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => set(value + 1)}
        disabled={value >= max}
        aria-label="הוספת כמות"
        className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:text-foreground disabled:opacity-30"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
