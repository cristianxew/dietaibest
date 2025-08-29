"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DietClassification {
  dietTypeName: string;
  isCompatible: boolean;
  confidence: number;
  reasons: string[];
  modifications?: string[];
}

interface DietBadgesProps {
  classifications: DietClassification[];
  primaryDiets?: string[];
  partialDiets?: string[];
  showAll?: boolean;
  className?: string;
}

export function DietBadges({
  classifications,
  primaryDiets = [],
  partialDiets = [],
  showAll = false,
  className,
}: DietBadgesProps) {
  // Filter to show only compatible diets unless showAll is true
  const dietsToShow = showAll
    ? classifications
    : classifications.filter(
        (diet) => diet.isCompatible || partialDiets.includes(diet.dietTypeName)
      );

  // Sort by compatibility and confidence
  const sortedDiets = [...dietsToShow].sort((a, b) => {
    if (a.isCompatible !== b.isCompatible) {
      return a.isCompatible ? -1 : 1;
    }
    return b.confidence - a.confidence;
  });

  if (sortedDiets.length === 0 && !showAll) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {sortedDiets.map((diet) => {
        const isPrimary = primaryDiets.includes(diet.dietTypeName);
        const isPartial = partialDiets.includes(diet.dietTypeName);
        const hasModifications =
          diet.modifications && diet.modifications.length > 0;

        return (
          <TooltipProvider key={diet.dietTypeName}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant={
                    diet.isCompatible
                      ? isPrimary
                        ? "default"
                        : "secondary"
                      : "outline"
                  }
                  className={cn(
                    "cursor-help",
                    !diet.isCompatible && "opacity-60",
                    isPartial && "border-dashed"
                  )}
                >
                  <div className="flex items-center gap-1">
                    {diet.isCompatible ? (
                      <Check className="h-3 w-3" />
                    ) : hasModifications ? (
                      <AlertCircle className="h-3 w-3" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                    <span>{formatDietName(diet.dietTypeName)}</span>
                    {diet.confidence < 80 && (
                      <span className="text-xs opacity-60">
                        ({diet.confidence}%)
                      </span>
                    )}
                  </div>
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <div className="space-y-2">
                  <p className="font-semibold">
                    {diet.isCompatible ? "Compatible" : "Not Compatible"}
                  </p>
                  {diet.reasons.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Reasons:</p>
                      <ul className="text-xs space-y-1">
                        {diet.reasons.map((reason, idx) => (
                          <li key={idx} className="pl-2">
                            • {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {hasModifications && (
                    <div className="space-y-1 border-t pt-2">
                      <p className="text-xs font-medium">
                        Modifications needed:
                      </p>
                      <ul className="text-xs space-y-1">
                        {diet.modifications!.map((mod, idx) => (
                          <li key={idx} className="pl-2">
                            • {mod}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}

function formatDietName(name: string): string {
  const nameMap: Record<string, string> = {
    vegan: "Vegan",
    vegetarian: "Vegetarian",
    pescatarian: "Pescatarian",
    paleo: "Paleo",
    keto: "Keto",
    "low-carb": "Low Carb",
    "gluten-free": "Gluten Free",
    "dairy-free": "Dairy Free",
    mediterranean: "Mediterranean",
    whole30: "Whole30",
  };

  return nameMap[name.toLowerCase()] || name;
}
