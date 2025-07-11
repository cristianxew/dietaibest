"use client";

import React, { useState, useEffect, useCallback } from "react";
import { RecipeFormData } from "@/types/recipe";
import {
  enhanceRecipe,
  quickQualityCheck,
  type RecipeEnhancement,
  //   type RecipeQualityScore,
  type RecipeImprovement,
} from "@/lib/recipe-enhancement";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Info,
  TrendingUp,
  Heart,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface RecipeEnhancerProps {
  recipe: RecipeFormData;
  onEnhancementApplied: (enhancedRecipe: RecipeFormData) => void;
  onAnalysisUpdate?: (analysis: RecipeEnhancement) => void;
  autoAnalyze?: boolean;
  className?: string;
}

export function RecipeEnhancer({
  recipe,
  onEnhancementApplied,
  onAnalysisUpdate,
  autoAnalyze = true,
  className,
}: RecipeEnhancerProps) {
  const [enhancement, setEnhancement] = useState<RecipeEnhancement | null>(
    null
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [quickAnalysis, setQuickAnalysis] = useState<{
    score: number;
    issues: string[];
  } | null>(null);

  // Quick analysis for real-time feedback
  const performQuickAnalysis = useCallback(() => {
    if (recipe.title || recipe.ingredients?.length > 0) {
      const analysis = quickQualityCheck(recipe);
      setQuickAnalysis(analysis);
    }
  }, [recipe]);

  // Full AI analysis
  const performFullAnalysis = useCallback(async () => {
    if (!recipe.title && !recipe.ingredients?.length) return;

    setIsAnalyzing(true);
    try {
      const result = await enhanceRecipe(recipe);
      setEnhancement(result);
      onAnalysisUpdate?.(result);
      toast.success("Recipe analysis completed!");
    } catch (error) {
      console.error("Analysis failed:", error);
      toast.error("Failed to analyze recipe. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [recipe, onAnalysisUpdate]);

  // Auto-analyze on recipe changes
  useEffect(() => {
    performQuickAnalysis();

    if (autoAnalyze && (recipe.title || recipe.ingredients?.length > 0)) {
      const timer = setTimeout(() => {
        performFullAnalysis();
      }, 2000); // Debounce for 2 seconds

      return () => clearTimeout(timer);
    }
  }, [recipe, autoAnalyze, performQuickAnalysis, performFullAnalysis]);

  // Apply AI enhancements
  const handleApplyEnhancements = async () => {
    if (!enhancement) return;

    setIsEnhancing(true);
    try {
      onEnhancementApplied(enhancement.enhanced);
      toast.success("AI enhancements applied successfully!");
    } catch (error) {
      console.error("Failed to apply enhancements:", error);
      toast.error("Failed to apply enhancements. Please try again.");
    } finally {
      setIsEnhancing(false);
    }
  };

  // Get quality color based on score
  const getQualityColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  // Get quality badge variant
  const getQualityBadge = (score: number) => {
    if (score >= 80) return "default";
    if (score >= 60) return "secondary";
    return "destructive";
  };

  // Render improvement item
  const renderImprovement = (improvement: RecipeImprovement, index: number) => {
    const Icon =
      improvement.severity === "high"
        ? AlertTriangle
        : improvement.severity === "medium"
        ? Info
        : CheckCircle;

    const colorClass =
      improvement.severity === "high"
        ? "text-red-500"
        : improvement.severity === "medium"
        ? "text-yellow-500"
        : "text-blue-500";

    return (
      <div
        key={index}
        className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
      >
        <Icon className={`h-4 w-4 mt-0.5 ${colorClass}`} />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium">{improvement.suggestion}</p>
          {improvement.originalValue && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Current:</span>{" "}
              {improvement.originalValue}
            </div>
          )}
          {improvement.suggestedValue && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Suggestion:</span>{" "}
              {improvement.suggestedValue}
            </div>
          )}
        </div>
        <Badge
          variant={
            improvement.severity === "high"
              ? "destructive"
              : improvement.severity === "medium"
              ? "secondary"
              : "outline"
          }
        >
          {improvement.type}
        </Badge>
      </div>
    );
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Recipe AI Assistant
            </CardTitle>
            {!autoAnalyze && (
              <Button
                onClick={performFullAnalysis}
                disabled={isAnalyzing}
                size="sm"
                variant="outline"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Analyze Recipe
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Quick Analysis */}
          {quickAnalysis && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Quick Quality Check</h4>
                <Badge variant={getQualityBadge(quickAnalysis.score)}>
                  {quickAnalysis.score}%
                </Badge>
              </div>
              <Progress value={quickAnalysis.score} className="h-2" />

              {quickAnalysis.issues.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <strong>Issues found:</strong>{" "}
                    {quickAnalysis.issues.join(", ")}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Full Analysis Results */}
          {enhancement && (
            <Tabs defaultValue="quality" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="quality">Quality</TabsTrigger>
                <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
                <TabsTrigger value="suggestions">Tips</TabsTrigger>
                <TabsTrigger value="tags">Tags</TabsTrigger>
              </TabsList>

              <TabsContent value="quality" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div
                      className={`text-2xl font-bold ${getQualityColor(
                        enhancement.qualityScore.overall
                      )}`}
                    >
                      {enhancement.qualityScore.overall}%
                    </div>
                    <div className="text-xs text-muted-foreground">Overall</div>
                  </div>

                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div
                      className={`text-2xl font-bold ${getQualityColor(
                        enhancement.qualityScore.completeness
                      )}`}
                    >
                      {enhancement.qualityScore.completeness}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Complete
                    </div>
                  </div>

                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div
                      className={`text-2xl font-bold ${getQualityColor(
                        enhancement.qualityScore.clarity
                      )}`}
                    >
                      {enhancement.qualityScore.clarity}%
                    </div>
                    <div className="text-xs text-muted-foreground">Clear</div>
                  </div>

                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div
                      className={`text-2xl font-bold ${getQualityColor(
                        enhancement.qualityScore.nutrition
                      )}`}
                    >
                      {enhancement.qualityScore.nutrition}%
                    </div>
                    <div className="text-xs text-muted-foreground">Healthy</div>
                  </div>
                </div>

                {enhancement.qualityScore.suggestions.length > 0 && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <strong>Quality Suggestions:</strong>
                        {enhancement.qualityScore.suggestions.map(
                          (suggestion, i) => (
                            <div key={i} className="text-sm">
                              • {suggestion}
                            </div>
                          )
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="nutrition" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold">
                      {enhancement.nutritionAnalysis.estimatedCalories}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Calories
                    </div>
                  </div>

                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold">
                      {enhancement.nutritionAnalysis.macros.protein}g
                    </div>
                    <div className="text-xs text-muted-foreground">Protein</div>
                  </div>

                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold">
                      {enhancement.nutritionAnalysis.macros.carbs}g
                    </div>
                    <div className="text-xs text-muted-foreground">Carbs</div>
                  </div>

                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold">
                      {enhancement.nutritionAnalysis.macros.fat}g
                    </div>
                    <div className="text-xs text-muted-foreground">Fat</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Health Score</span>
                    <Badge
                      variant={getQualityBadge(
                        enhancement.nutritionAnalysis.healthScore
                      )}
                    >
                      {enhancement.nutritionAnalysis.healthScore}%
                    </Badge>
                  </div>
                  <Progress
                    value={enhancement.nutritionAnalysis.healthScore}
                    className="h-2"
                  />
                </div>

                {enhancement.nutritionAnalysis.dietaryFlags.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Dietary Information</h4>
                    <div className="flex flex-wrap gap-2">
                      {enhancement.nutritionAnalysis.dietaryFlags.map(
                        (flag) => (
                          <Badge
                            key={flag}
                            variant="outline"
                            className="text-xs"
                          >
                            {flag}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="suggestions" className="space-y-4">
                {enhancement.improvements.length > 0 ? (
                  <div className="space-y-3">
                    {enhancement.improvements.map((improvement, i) =>
                      renderImprovement(improvement, i)
                    )}
                  </div>
                ) : (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Great job! No major improvements needed. Your recipe looks
                      excellent!
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="tags" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">
                      Auto-generated Categories
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {enhancement.autoCategories.length > 0 ? (
                        enhancement.autoCategories.map((category) => (
                          <Badge key={category} variant="secondary">
                            {category}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No categories detected
                        </span>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="text-sm font-medium mb-2">Suggested Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {enhancement.autoTags.length > 0 ? (
                        enhancement.autoTags.map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No tags suggested
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {/* Apply Enhancements Button */}
          {enhancement && (
            <div className="pt-4 border-t">
              <Button
                onClick={handleApplyEnhancements}
                disabled={isEnhancing}
                className="w-full"
                size="lg"
              >
                {isEnhancing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Applying Enhancements...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Apply AI Enhancements
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center mt-2">
                This will automatically fill nutrition data and add suggested
                tags
              </p>
            </div>
          )}

          {/* Loading State */}
          {isAnalyzing && !enhancement && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-500" />
                <div className="text-sm text-muted-foreground">
                  AI is analyzing your recipe...
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Simplified version for quick quality display
export function QuickQualityIndicator({ recipe }: { recipe: RecipeFormData }) {
  const [analysis, setAnalysis] = useState<{
    score: number;
    issues: string[];
  } | null>(null);

  useEffect(() => {
    if (recipe.title || recipe.ingredients?.length > 0) {
      const result = quickQualityCheck(recipe);
      setAnalysis(result);
    } else {
      setAnalysis(null);
    }
  }, [recipe]);

  if (!analysis) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex items-center gap-1">
        <Heart
          className={`h-4 w-4 ${
            analysis.score >= 80
              ? "text-green-500"
              : analysis.score >= 60
              ? "text-yellow-500"
              : "text-red-500"
          }`}
        />
        <span className="font-medium">Quality: {analysis.score}%</span>
      </div>

      {analysis.issues.length > 0 && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <AlertTriangle className="h-3 w-3" />
          <span>
            {analysis.issues.length} issue
            {analysis.issues.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
