"use client";

import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

interface PortionsSelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function PortionsSelector({
  value,
  onChange,
  min = 1,
  max = 20,
}: PortionsSelectorProps) {
  const t = useTranslations("recipes.portions");

  return (
    <div className="flex items-center justify-between p-4 bg-card border border-border/60 rounded-xl shadow-sm">
      <h3 className="text-sm font-bold text-foreground">
        {t("adjustServings", { fallback: "Adjust servings" })}
      </h3>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-md shrink-0 border-border/80 text-foreground"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="w-10 text-center text-sm font-bold font-display tabular-nums">
          {value}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-md shrink-0 border-border/80 text-foreground"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
