"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  ArrowRight,
  Link2,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// URL validation schema
const urlSchema = z.object({
  url: z
    .string()
    .url("Please enter a valid URL")
    .refine((url) => {
      try {
        const urlObj = new URL(url);
        return urlObj.protocol === "http:" || urlObj.protocol === "https:";
      } catch {
        return false;
      }
    }, "URL must start with http:// or https://"),
});

type UrlFormData = z.infer<typeof urlSchema>;

interface ExtractedRecipeData {
  title: string;
  description?: string;
  ingredients: Array<{
    name: string;
    amount: number;
    unit: string;
  }>;
  instructions: string[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  difficulty?: string;
  cuisine?: string;
  tags?: string[];
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  imageUrl?: string;
}

interface URLUploadProps {
  onURLUploaded?: (urlData: {
    url: string;
    extractedData?: ExtractedRecipeData;
  }) => void;
  onUploadError?: (error: string) => void;
}

interface UploadState {
  status:
    | "idle"
    | "validating"
    | "fetching"
    | "processing"
    | "analyzing"
    | "success"
    | "error";
  progress: number;
  message: string;
  url?: string;
}

export function URLUpload({ onURLUploaded, onUploadError }: URLUploadProps) {
  const t = useTranslations("recipes.urlUpload");
  const [uploadState, setUploadState] = useState<UploadState>({
    status: "idle",
    progress: 0,
    message: "",
  });
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const form = useForm<UrlFormData>({
    resolver: zodResolver(urlSchema),
    defaultValues: {
      url: "",
    },
  });

  // Safe state update function to prevent updates on unmounted components
  const safeSetUploadState = useCallback(
    (updater: (prev: UploadState) => UploadState) => {
      if (isMountedRef.current) {
        setUploadState(updater);
      }
    },
    [] // No dependencies needed since isMountedRef.current is stable
  );

  // Validate URL format
  const validateURL = useCallback(
    (url: string): { isValid: boolean; error?: string } => {
      if (!url.trim()) {
        return {
          isValid: false,
          error: t("errors.urlRequired"),
        };
      }

      try {
        const urlObj = new URL(url);
        if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
          return {
            isValid: false,
            error: t("errors.invalidProtocol"),
          };
        }
        return { isValid: true };
      } catch {
        return {
          isValid: false,
          error: t("errors.invalidUrl"),
        };
      }
    },
    [t] // Only depend on t
  );

  // Fetch and process URL
  const fetchURLAndProcess = useCallback(
    async (url: string): Promise<ExtractedRecipeData | null> => {
      // Phase 1: Fetching (0-30%)
      safeSetUploadState((prev) => ({
        ...prev,
        status: "fetching",
        progress: 0,
        message: t("status.fetching"),
      }));

      try {
        // Simulate fetching progress
        for (let i = 0; i <= 30; i += 5) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          safeSetUploadState((prev) => ({ ...prev, progress: i }));
        }

        // Phase 2: Processing (30-70%)
        safeSetUploadState((prev) => ({
          ...prev,
          status: "processing",
          message: t("status.extractingRecipe"),
          progress: 30,
        }));

        // Call backend API
        const response = await fetch("/api/recipes/import/url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url }),
        });

        // Simulate processing progress
        for (let i = 40; i <= 70; i += 10) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          safeSetUploadState((prev) => ({ ...prev, progress: i }));
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Unable to extract recipe from this URL. The website might not be supported or the page doesn't contain a valid recipe."
          );
        }

        // Phase 3: Analyzing (70-95%)
        safeSetUploadState((prev) => ({
          ...prev,
          status: "analyzing",
          message: t("status.analyzingContent"),
          progress: 70,
        }));

        for (let i = 75; i <= 95; i += 5) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          safeSetUploadState((prev) => ({ ...prev, progress: i }));
        }

        // Phase 4: Complete (95-100%)
        safeSetUploadState((prev) => ({
          ...prev,
          status: "success",
          message: t("status.complete"),
          progress: 100,
        }));

        // Transform the result to match our interface
        if (result.title) {
          return {
            title: result.title || "Imported Recipe",
            description: result.description || "",
            ingredients: result.ingredients || [],
            instructions: result.instructions || [],
            prepTime: result.prepTime,
            cookTime: result.cookTime,
            servings: result.servings || 4,
            difficulty: result.difficulty,
            cuisine: result.cuisine,
            tags: result.tags || [],
            calories: result.calories,
            protein: result.protein,
            carbs: result.carbs,
            fat: result.fat,
            imageUrl: result.imageUrl,
          };
        }

        return null;
      } catch (error) {
        console.error("URL processing error:", error);
        throw new Error(
          error instanceof Error ? error.message : t("errors.processingFailed")
        );
      }
    },
    [t, safeSetUploadState] // Minimal dependencies
  );

  // Handle URL processing
  const processURL = useCallback(
    async (url: string) => {
      safeSetUploadState((prev) => ({
        ...prev,
        status: "validating",
        progress: 0,
        message: t("status.validating"),
        url,
      }));

      try {
        // Validate the URL
        const validation = validateURL(url);
        if (!validation.isValid) {
          safeSetUploadState((prev) => ({
            ...prev,
            status: "error",
            progress: 0,
            message: validation.error || t("errors.validationFailed"),
          }));
          onUploadError?.(validation.error || t("errors.validationFailed"));
          toast.error(validation.error || t("errors.validationFailed"));
          return;
        }

        // Fetch and process the URL
        const extractedData = await fetchURLAndProcess(url);

        // Notify parent component
        onURLUploaded?.({
          url,
          extractedData: extractedData || undefined,
        });

        if (extractedData) {
          // Show detailed extraction summary
          const extractedFields = [];
          if (extractedData.ingredients.length > 0)
            extractedFields.push(
              `${extractedData.ingredients.length} ingredients`
            );
          if (extractedData.instructions.length > 0)
            extractedFields.push(`${extractedData.instructions.length} steps`);
          if (extractedData.calories) extractedFields.push("nutrition info");
          if (extractedData.difficulty)
            extractedFields.push(`difficulty: ${extractedData.difficulty}`);
          if (extractedData.cuisine)
            extractedFields.push(`cuisine: ${extractedData.cuisine}`);
          if (extractedData.tags && extractedData.tags.length > 0)
            extractedFields.push(`${extractedData.tags.length} tags`);

          const message =
            extractedFields.length > 0
              ? `Recipe extracted with ${extractedFields.join(", ")}`
              : "Recipe extracted successfully";

          toast.success(message);
        } else {
          toast.warning(
            "URL processed but could not extract recipe data automatically"
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : t("errors.processingFailed");
        safeSetUploadState((prev) => ({
          ...prev,
          status: "error",
          progress: 0,
          message: errorMessage,
        }));
        onUploadError?.(errorMessage);
        toast.error(errorMessage);
      }
    },
    [
      t,
      safeSetUploadState,
      validateURL,
      fetchURLAndProcess,
      onURLUploaded,
      onUploadError,
    ] // Keep necessary dependencies
  );

  // Handle form submission - wrap in useCallback to prevent recreation
  const handleSubmit = useCallback(
    async (data: UrlFormData) => {
      await processURL(data.url);
    },
    [processURL]
  );

  // Reset upload state
  const resetUpload = () => {
    setUploadState({
      status: "idle",
      progress: 0,
      message: "",
    });
    form.reset();
  };

  // Render status icon
  const renderStatusIcon = () => {
    switch (uploadState.status) {
      case "validating":
      case "fetching":
      case "processing":
      case "analyzing":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Link2 className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const isLoading = [
    "validating",
    "fetching",
    "processing",
    "analyzing",
  ].includes(uploadState.status);

  return (
    <div className="space-y-4">
      <Card
        className={cn(
          "transition-all duration-200",
          uploadState.status === "success" && "border-green-500 bg-green-50",
          uploadState.status === "error" && "border-red-500 bg-red-50"
        )}
      >
        <CardContent className="p-6 space-y-4">
          {/* URL Form */}
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("recipeUrl")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://example.com/recipe/..."
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormDescription>{t("enterRecipeUrl")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status and Progress */}
              {uploadState.status !== "idle" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {renderStatusIcon()}
                    <span className="font-medium">
                      {uploadState.message || t("status.ready")}
                    </span>
                  </div>

                  {/* Progress bar */}
                  {isLoading && (
                    <div className="space-y-2">
                      <Progress
                        value={uploadState.progress}
                        className="w-full"
                      />
                      <p className="text-sm text-muted-foreground">
                        {uploadState.progress}% {t("complete")}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {uploadState.message}
                  </>
                ) : (
                  <>
                    {t("importButton")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              {/* Action buttons for success/error states */}
              {uploadState.status === "success" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetUpload}
                  className="w-full"
                >
                  {t("importAnother")}
                </Button>
              )}

              {uploadState.status === "error" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetUpload}
                  className="w-full"
                >
                  {t("tryAgain")}
                </Button>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Error alert */}
      {uploadState.status === "error" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{uploadState.message}</AlertDescription>
        </Alert>
      )}

      {/* Success alert */}
      {uploadState.status === "success" && (
        <Alert className="border-green-500 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-700">
            {t("extractionSuccess")}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
