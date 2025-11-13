"use client";

import { useState } from "react";
import { Loader2, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { generateAIMealPlan } from "@/actions/meal-plan-ai";
import type { MealType } from "@/types/meal-plan";
import type { AIGeneratedPlan, AgentThought } from "@/types/ai-agents";
import { AISuggestionReview } from "./AISuggestionReview";

interface AIGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string;
  duration: number;
  mealSlots: MealType[];
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
  onSuggestionsApplied?: () => void;
}

type GenerationStep = "idle" | "generating" | "complete" | "error" | "review";

export function AIGenerationModal({
  isOpen,
  onClose,
  templateId,
  duration,
  mealSlots,
  targetCalories,
  targetProtein,
  targetCarbs,
  targetFat,
  onSuggestionsApplied,
}: AIGenerationModalProps) {
  const [step, setStep] = useState<GenerationStep>("idle");
  const [progress, setProgress] = useState(0);
  const [thoughts, setThoughts] = useState<AgentThought[]>([]);
  const [generatedPlan, setGeneratedPlan] = useState<AIGeneratedPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setStep("generating");
    setProgress(0);
    setThoughts([]);
    setError(null);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const result = await generateAIMealPlan({
        templateId,
        duration,
        mealSlots,
        targetCalories,
        targetProtein,
        targetCarbs,
        targetFat,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (result.error || !result.data) {
        setError(result.error || "Failed to generate meal plan");
        setStep("error");
        return;
      }

      setGeneratedPlan(result.data);
      setThoughts(result.data.agentThoughts);
      setStep("complete");

      // Auto-transition to review after a short delay
      setTimeout(() => {
        setStep("review");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setStep("error");
    }
  };

  const handleRegenerate = () => {
    setStep("idle");
    setGeneratedPlan(null);
    setThoughts([]);
    setError(null);
    handleGenerate();
  };

  const handleClose = () => {
    setStep("idle");
    setGeneratedPlan(null);
    setThoughts([]);
    setError(null);
    setProgress(0);
    onClose();
  };

  const getAgentIcon = (agent: string) => {
    switch (agent) {
      case "coordinator":
        return "🎯";
      case "nutrition":
        return "🥗";
      case "family":
        return "👨‍👩‍👧";
      case "budget":
        return "💰";
      case "sustainability":
        return "♻️";
      default:
        return "🤖";
    }
  };

  const getThoughtTypeColor = (type: AgentThought["type"]) => {
    switch (type) {
      case "analysis":
        return "text-blue-600 dark:text-blue-400";
      case "decision":
        return "text-green-600 dark:text-green-400";
      case "conflict":
        return "text-yellow-600 dark:text-yellow-400";
      case "suggestion":
        return "text-purple-600 dark:text-purple-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  if (step === "review" && generatedPlan) {
    return (
      <AISuggestionReview
        isOpen={isOpen}
        onClose={handleClose}
        plan={generatedPlan}
        templateId={templateId}
        onRegenerate={handleRegenerate}
        onSuggestionsApplied={onSuggestionsApplied}
      />
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Meal Plan Generator
          </DialogTitle>
          <DialogDescription>
            Our AI agents will collaborate to create an optimized meal plan for you
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Goals Summary */}
          <div className="rounded-lg border p-4 bg-muted/50">
            <h3 className="font-semibold mb-2">📊 Your Goals</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>• Duration: {duration} days</div>
              <div>• Meals/day: {mealSlots.length}</div>
              {targetCalories && <div>• Target: {targetCalories} cal/day</div>}
              {targetProtein && <div>• Protein: {targetProtein}g/day</div>}
            </div>
          </div>

          {/* Idle State */}
          {step === "idle" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="text-center">
                <p className="text-muted-foreground">
                  Ready to generate your AI-powered meal plan?
                </p>
              </div>
              <Button onClick={handleGenerate} size="lg" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Generate Meal Plan
              </Button>
            </div>
          )}

          {/* Generating State */}
          {step === "generating" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">Generating...</span>
                <span className="text-sm text-muted-foreground ml-auto">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />

              <ScrollArea className="h-[300px] rounded-lg border p-4">
                <div className="space-y-3">
                  {thoughts.map((thought, index) => (
                    <div
                      key={index}
                      className="flex gap-2 text-sm animate-in slide-in-from-bottom-2"
                    >
                      <span className="text-lg shrink-0">{getAgentIcon(thought.agent)}</span>
                      <div className="flex-1">
                        <div className="font-medium text-xs text-muted-foreground mb-1">
                          {thought.agentName}
                        </div>
                        <p className={getThoughtTypeColor(thought.type)}>
                          {thought.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Complete State */}
          {step === "complete" && generatedPlan && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <div className="text-center">
                <h3 className="font-semibold text-lg">Plan Generated!</h3>
                <p className="text-muted-foreground">
                  {generatedPlan.matchPercentage}% match to your goals
                </p>
              </div>
              <Progress value={100} className="h-2 w-full" />
            </div>
          )}

          {/* Error State */}
          {step === "error" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <AlertCircle className="h-16 w-16 text-destructive" />
              <div className="text-center">
                <h3 className="font-semibold text-lg">Generation Failed</h3>
                <p className="text-muted-foreground text-sm mt-2">{error}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleRegenerate} variant="outline">
                  Try Again
                </Button>
                <Button onClick={handleClose} variant="default">
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
