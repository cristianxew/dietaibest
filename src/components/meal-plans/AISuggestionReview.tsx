"use client";

import { useState } from "react";
import { Check, X, RefreshCw, Loader2, TrendingUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { applyAISuggestionsToTemplate } from "@/actions/meal-plan-ai";
import type { AIGeneratedPlan } from "@/types/ai-agents";
import { useRouter } from "next/navigation";

interface AISuggestionReviewProps {
  isOpen: boolean;
  onClose: () => void;
  plan: AIGeneratedPlan;
  templateId: string;
  onRegenerate: () => void;
  onSuggestionsApplied?: () => void;
}

export function AISuggestionReview({
  isOpen,
  onClose,
  plan,
  templateId,
  onRegenerate,
  onSuggestionsApplied,
}: AISuggestionReviewProps) {
  const [isApplying, setIsApplying] = useState(false);
  const router = useRouter();

  const handleAccept = async () => {
    setIsApplying(true);

    try {
      const result = await applyAISuggestionsToTemplate(templateId, plan.suggestions);

      if (result.error) {
        alert(result.error);
        return;
      }

      // Success!
      onSuggestionsApplied?.();
      router.refresh();
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to apply suggestions");
    } finally {
      setIsApplying(false);
    }
  };

  // Group suggestions by day
  const suggestionsByDay = plan.suggestions.reduce((acc, suggestion) => {
    if (!acc[suggestion.dayNumber]) {
      acc[suggestion.dayNumber] = [];
    }
    acc[suggestion.dayNumber].push(suggestion);
    return acc;
  }, {} as Record<number, typeof plan.suggestions>);

  const days = Object.keys(suggestionsByDay)
    .map(Number)
    .sort((a, b) => a - b);

  const getMealTypeEmoji = (mealType: string) => {
    switch (mealType) {
      case "breakfast":
        return "🍳";
      case "morningSnack":
        return "🥐";
      case "lunch":
        return "🥗";
      case "afternoonSnack":
        return "🍎";
      case "dinner":
        return "🍝";
      case "eveningSnack":
        return "🍪";
      case "snack":
        return "🥜";
      default:
        return "🍽️";
    }
  };

  const formatMealType = (mealType: string) => {
    return mealType
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  const getMatchStatusColor = (percentage: number) => {
    if (percentage >= 90) return "bg-green-500";
    if (percentage >= 75) return "bg-yellow-500";
    return "bg-orange-500";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            AI-Generated Meal Plan
          </DialogTitle>
          <DialogDescription>
            Review and accept these AI suggestions, or regenerate for new options
          </DialogDescription>
        </DialogHeader>

        {/* Match Summary */}
        <Card className="p-4 bg-muted/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Goal Match</h3>
            <Badge
              variant={plan.matchPercentage >= 90 ? "default" : "secondary"}
              className="text-lg px-3 py-1"
            >
              {plan.matchPercentage}%
            </Badge>
          </div>

          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Calories</div>
              <div className="font-medium">
                {Math.round(plan.averageDailyMacros.calories)} cal/day
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Protein</div>
              <div className="font-medium">
                {Math.round(plan.averageDailyMacros.protein)}g/day
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Carbs</div>
              <div className="font-medium">
                {Math.round(plan.averageDailyMacros.carbs)}g/day
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Fat</div>
              <div className="font-medium">
                {Math.round(plan.averageDailyMacros.fat)}g/day
              </div>
            </div>
          </div>
        </Card>

        {/* AI Reasoning */}
        <Card className="p-4">
          <h3 className="font-semibold mb-2">💡 AI Reasoning</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {plan.reasoning.map((reason, index) => (
              <li key={index}>• {reason}</li>
            ))}
          </ul>
        </Card>

        {/* Meal Plan */}
        <ScrollArea className="h-[300px]">
          <div className="space-y-4 pr-4">
            {days.map(dayNumber => (
              <Card key={dayNumber} className="p-4">
                <h3 className="font-semibold mb-3">
                  Day {dayNumber}
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    {suggestionsByDay[dayNumber].reduce(
                      (sum, meal) => sum + meal.macros.calories,
                      0
                    ).toFixed(0)}{" "}
                    cal
                  </span>
                </h3>

                <div className="space-y-2">
                  {suggestionsByDay[dayNumber].map((suggestion, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-2xl">
                        {getMealTypeEmoji(suggestion.mealType)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground uppercase">
                            {formatMealType(suggestion.mealType)}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-xs"
                          >
                            {Math.round(suggestion.agentScores.overall)}/100
                          </Badge>
                        </div>
                        <div className="font-medium">{suggestion.recipeName}</div>
                        <div className="text-sm text-muted-foreground">
                          {Math.round(suggestion.macros.calories)} cal •{" "}
                          {Math.round(suggestion.macros.protein)}g protein •{" "}
                          {Math.round(suggestion.macros.carbs)}g carbs •{" "}
                          {Math.round(suggestion.macros.fat)}g fat
                        </div>
                        {suggestion.reasoning && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {suggestion.reasoning}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button onClick={onClose} variant="outline" disabled={isApplying}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={onRegenerate} variant="outline" disabled={isApplying}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate
          </Button>
          <Button onClick={handleAccept} disabled={isApplying}>
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Accept & Apply
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
