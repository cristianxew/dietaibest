"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIGenerationModal } from "./AIGenerationModal";
import type { MealType } from "@/types/meal-plan";

interface AIGenerateButtonProps {
  templateId: string;
  duration: number;
  mealSlots: MealType[];
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
  onSuggestionsApplied?: () => void;
}

export function AIGenerateButton({
  templateId,
  duration,
  mealSlots,
  targetCalories,
  targetProtein,
  targetCarbs,
  targetFat,
  onSuggestionsApplied,
}: AIGenerateButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsModalOpen(true)}
        variant="default"
        size="default"
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        AI Generate
      </Button>

      <AIGenerationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        templateId={templateId}
        duration={duration}
        mealSlots={mealSlots}
        targetCalories={targetCalories}
        targetProtein={targetProtein}
        targetCarbs={targetCarbs}
        targetFat={targetFat}
        onSuggestionsApplied={onSuggestionsApplied}
      />
    </>
  );
}
