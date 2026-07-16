"use client";

import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { NutrientCoverage } from "@/lib/nutrients/aggregate";

interface CoverageBadgeProps {
  coverage: NutrientCoverage;
  matched: number;
  total: number;
}

/**
 * Honesty pill for recipe profiles whose ingredients aren't fully matched
 * to USDA foods — full coverage renders nothing.
 */
export function CoverageBadge({ coverage, matched, total }: CoverageBadgeProps) {
  const t = useTranslations("nutritionHub.compare.coverage");

  if (coverage === "full") return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className="gap-1 text-stone-500 dark:text-stone-400 border-stone-300 dark:border-stone-600"
        >
          <TriangleAlert className="w-3 h-3" />
          {coverage === "macrosOnly"
            ? t("macrosOnly")
            : t("partial", { matched, total })}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">
        {t("tooltip")}
      </TooltipContent>
    </Tooltip>
  );
}
