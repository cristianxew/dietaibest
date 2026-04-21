"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";

interface InstructionsListProps {
  instructions: string[];
}

export function InstructionsList({ instructions }: InstructionsListProps) {
  const t = useTranslations("recipes");
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  if (!instructions || instructions.length === 0) {
    return null;
  }

  const toggleStep = (index: number) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const totalCount = instructions.length;

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-6 md:p-8 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-border/40">
        <h2 className="text-2xl font-display font-bold text-foreground">
          {t("instructions", { fallback: "Instructions" })}
        </h2>
        <span className="text-sm font-medium text-muted-foreground">
          {completedCount}/{totalCount} {t("done", { fallback: "done" })}
        </span>
      </div>

      <div>
        {instructions.map((instruction, index) => {
          const isCompleted = !!completedSteps[index];

          return (
            <div
              key={index}
              className={`flex gap-5 group cursor-pointer transition-opacity duration-200 py-4 border-b border-border/40 last:border-0 last:pb-0 first:pt-0 ${isCompleted ? "opacity-50" : "opacity-100"}`}
              onClick={() => toggleStep(index)}
            >
              <div
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-display border-2 transition-colors mt-0.5 ${isCompleted
                    ? "bg-brand-500 border-brand-500 text-white"
                    : "bg-transparent border-brand-300 text-brand-600 dark:border-brand-700 dark:text-brand-400"
                  }`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : index + 1}
              </div>
              <p
                className={`flex-1 text-[15px] leading-relaxed pt-0.5 ${isCompleted ? "line-through text-muted-foreground" : "text-foreground/90"
                  }`}
              >
                {instruction}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
