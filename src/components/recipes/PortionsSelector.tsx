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
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-foreground">
        {t("title")}
      </h3>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-8 text-center text-xl font-bold font-display tabular-nums">
          {value}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("helperText")}
      </p>
    </div>
  );
}
