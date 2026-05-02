"use client";

import React, { useCallback } from "react";
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
import type { ImportedRecipe } from "@/types/recipe";
import { useRecipeExtraction } from "@/hooks/use-recipe-extraction";

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

interface URLUploadProps {
  onURLUploaded?: (urlData: {
    url: string;
    extractedData?: ImportedRecipe;
  }) => void;
  onUploadError?: (error: string) => void;
  useSSE?: boolean; // Use Server-Sent Events for real-time updates (default: true)
}

export function URLUpload({
  onURLUploaded,
  onUploadError,
  useSSE = true,
}: URLUploadProps) {
  const t = useTranslations("recipes.urlUpload");
  const {
    state: uploadState,
    extract,
    cancel,
    reset,
  } = useRecipeExtraction({ useSSE });

  const form = useForm<UrlFormData>({
    resolver: zodResolver(urlSchema),
    defaultValues: {
      url: "",
    },
  });

  const handleSubmit = useCallback(
    async (data: UrlFormData) => {
      try {
        const extractedData = await extract(data.url);

        onURLUploaded?.({
          url: data.url,
          extractedData: extractedData || undefined,
        });

        if (extractedData) {
          const extractedFields = [];
          if (extractedData.ingredients.length > 0)
            extractedFields.push(
              `${extractedData.ingredients.length} ingredients`,
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
            "URL processed but could not extract recipe data automatically",
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (!errorMessage.toLowerCase().includes("cancel")) {
          onUploadError?.(errorMessage);
          toast.error(errorMessage);
        }
      }
    },
    [extract, onURLUploaded, onUploadError],
  );

  const onFormError = useCallback((errors: { url?: { message?: string } }) => {
    if (errors.url?.message) {
      toast.error(errors.url.message);
    }
  }, []);

  const cancelExtraction = useCallback(async () => {
    await cancel();
    toast.info(t("extractionCancelled"));
  }, [cancel, t]);

  const resetUpload = useCallback(() => {
    reset();
    form.reset();
  }, [reset, form]);

  const renderStatusIcon = () => {
    switch (uploadState.status) {
      case "validating":
      case "starting":
      case "polling":
      case "processing":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "error":
      case "cancelled":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Link2 className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const isLoading = [
    "validating",
    "starting",
    "polling",
    "processing",
  ].includes(uploadState.status);

  return (
    <div className="space-y-4">
      <Card
        className={cn(
          "transition-all duration-200",
          uploadState.status === "success" && "border-green-500 bg-green-50",
          (uploadState.status === "error" ||
            uploadState.status === "cancelled") &&
            "border-red-500 bg-red-50",
        )}
      >
        <CardContent className="p-6 space-y-4">
          {/* URL Form */}
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit, onFormError)}
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

                  {/* Progress bar and extraction details */}
                  {isLoading && (
                    <div className="space-y-2">
                      <Progress
                        value={uploadState.progress}
                        className="w-full"
                      />
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-muted-foreground">
                          {uploadState.progress}% {t("complete")}
                        </p>
                        {uploadState.currentStep !== undefined && (
                          <p className="text-sm text-muted-foreground">
                            Step {uploadState.currentStep}
                          </p>
                        )}
                      </div>
                      {uploadState.currentUrl && (
                        <p className="text-xs text-muted-foreground truncate">
                          <span className="font-medium">Current page:</span>{" "}
                          {uploadState.currentUrl}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Submit and Cancel Buttons */}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className={isLoading ? "flex-1" : "w-full"}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {uploadState.message || t("status.starting")}
                    </>
                  ) : (
                    <>
                      {t("importButton")}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>

                {/* Cancel button - only show when actively extracting */}
                {isLoading && uploadState.taskId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={cancelExtraction}
                    className="px-4"
                  >
                    {t("cancel")}
                  </Button>
                )}
              </div>

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

              {(uploadState.status === "error" ||
                uploadState.status === "cancelled") && (
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
