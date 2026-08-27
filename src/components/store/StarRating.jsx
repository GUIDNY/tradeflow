import React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StarRating({ value = 0, reviews, size = 14, className }) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={size}
            className={cn(
              "shrink-0",
              value >= star - 0.5 ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
            )}
          />
        ))}
      </div>
      <span className="ltr-nums text-xs text-muted-foreground">
        {value.toFixed(1)}
        {typeof reviews === "number" ? ` (${reviews})` : ""}
      </span>
    </div>
  );
}
