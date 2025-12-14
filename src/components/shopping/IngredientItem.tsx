"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface IngredientItemProps {
  id: string;
  name: string;
  amount: number;
  unit: string;
  isChecked: boolean;
  onToggle: () => void;
}

export function IngredientItem({
  id,
  name,
  amount,
  unit,
  isChecked,
  onToggle,
}: IngredientItemProps) {
  // Format amount for display
  const formatAmount = (amt: number): string => {
    if (amt === Math.floor(amt)) {
      return amt.toString();
    }
    return amt.toFixed(1);
  };

  // Format the quantity display
  const quantityDisplay =
    unit === "piece"
      ? `${formatAmount(amount)}x`
      : `${formatAmount(amount)} ${unit}`;

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-2.5 px-3 rounded-lg",
        "transition-all duration-200",
        "hover:bg-muted/50",
        isChecked && "opacity-60"
      )}
    >
      <Checkbox
        id={id}
        checked={isChecked}
        onCheckedChange={onToggle}
        className="shrink-0"
      />
      <label
        htmlFor={id}
        className={cn(
          "flex-1 cursor-pointer text-sm",
          "transition-all duration-200",
          isChecked && "line-through text-muted-foreground"
        )}
      >
        <span className="font-medium capitalize">{name}</span>
      </label>
      <span
        className={cn(
          "text-sm text-muted-foreground shrink-0",
          isChecked && "line-through"
        )}
      >
        {quantityDisplay}
      </span>
    </div>
  );
}
