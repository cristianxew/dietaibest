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
import type { ImportedRecipe } from "@/types/recipe";
import { useRecipeErrorTranslation } from "@/hooks/use-recipe-extraction";

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

interface UploadState {
  status:
    | "idle"
    | "validating"
    | "starting"
    | "polling"
    | "processing"
    | "success"
    | "error";
  progress: number;
  message: string;
  url?: string;
  taskId?: string;
  currentStep?: number;
  currentUrl?: string;
}

export function URLUpload({
  onURLUploaded,
  onUploadError,
  useSSE = true,
}: URLUploadProps) {
  const t = useTranslations("recipes.urlUpload");
  const getErrorMessage = useRecipeErrorTranslation();
  const [uploadState, setUploadState] = useState<UploadState>({
    status: "idle",
    progress: 0,
    message: "",
  });
  const isMountedRef = useRef(true);
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Clean up EventSource if it exists
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      // Abort any ongoing fetch requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const form = useForm<UrlFormData>({
    resolver: zodResolver(urlSchema),
    defaultValues: {
      url: "",
    },
  });



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

  // Start extraction task and monitor status
  const fetchURLAndProcess = useCallback(
    async (url: string): Promise<ImportedRecipe | null> => {
      // Phase 1: Starting task
      if (isMountedRef.current) {
        setUploadState((prev) => ({
          ...prev,
          status: "starting",
          progress: 0,
          message: t("status.starting"),
        }));
      }

      try {
        // Start the extraction task
        const startResponse = await fetch("/api/recipes/import/url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url }),
        });

        const startResult = await startResponse.json();

        if (!startResponse.ok) {
          throw new Error(
            startResult.error ||
              "Unable to start recipe extraction. Please try again."
          );
        }

        const { taskId } = startResult;

        // Update state with task ID
        if (isMountedRef.current) {
          setUploadState((prev) => ({
            ...prev,
            taskId,
            status: "polling",
            progress: 5,
            message: t("status.extractingRecipe"),
          }));
        }

        // Phase 2: Monitor task status (SSE or polling)
        if (useSSE) {
          // Use Server-Sent Events for real-time updates
          return new Promise<ImportedRecipe | null>((resolve, reject) => {
            // Clean up any existing EventSource completely before creating new one
            if (eventSourceRef.current) {
              const oldEventSource = eventSourceRef.current;
              try {
                oldEventSource.close();
                console.log("[URLUpload] Closed old EventSource");
              } catch (error) {
                console.warn(
                  "[URLUpload] Error closing old EventSource:",
                  error
                );
              }
              // Immediately set to null to prevent orphaned references
              eventSourceRef.current = null;
            }

            // Create new EventSource
            console.log(
              `[URLUpload] Creating new EventSource for task ${taskId}`
            );
            const eventSource = new EventSource(
              `/api/recipes/import/url/status?taskId=${taskId}`
            );
            eventSourceRef.current = eventSource;

            eventSource.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data);

                // Update UI based on event type
                switch (data.type) {
                  case "connected":
                    console.log("[URLUpload] Connected to SSE stream");
                    break;

                  case "status":
                    console.log(
                      `[URLUpload] Status update: ${data.status} - ${data.progress}%`
                    );
                    if (isMountedRef.current) {
                      setUploadState((prev) => ({
                        ...prev,
                        status: "polling",
                        progress: data.progress || prev.progress,
                        message: data.message || prev.message,
                        currentStep: data.currentStep,
                        currentUrl: data.currentUrl,
                      }));
                    }
                    break;

                  case "complete":
                    console.log("[URLUpload] Recipe extraction completed");
                    if (isMountedRef.current) {
                      setUploadState((prev) => ({
                        ...prev,
                        status: "success",
                        progress: 100,
                        message: t("status.complete"),
                      }));
                    }

                    // Only close if this is still the current EventSource
                    if (eventSourceRef.current === eventSource) {
                      eventSource.close();
                      eventSourceRef.current = null;
                      console.log(
                        "[URLUpload] Closed EventSource after completion"
                      );
                    }

                    // Resolve with the extracted data
                    if (data.data) {
                      resolve({
                        title: data.data.title || "Imported Recipe",
                        description: data.data.description || "",
                        ingredients: data.data.ingredients || [],
                        instructions: data.data.instructions || [],
                        prepTime: data.data.prepTime,
                        cookTime: data.data.cookTime,
                        servings: data.data.servings || 4,
                        difficulty: data.data.difficulty,
                        cuisine: data.data.cuisine,
                        tags: data.data.tags || [],
                        calories: data.data.calories,
                        protein: data.data.protein,
                        carbs: data.data.carbs,
                        fat: data.data.fat,
                        imageUrl: data.data.imageUrl,
                      });
                    } else {
                      resolve(null);
                    }
                    break;

                  case "error":
                  case "failed":
                  case "stopped":
                    console.error(
                      `[URLUpload] Extraction ${data.type}:`,
                      data.message
                    );

                    // Only close if this is still the current EventSource
                    if (eventSourceRef.current === eventSource) {
                      eventSource.close();
                      eventSourceRef.current = null;
                      console.log("[URLUpload] Closed EventSource after error");
                    }

                    reject(
                      new Error(data.message || "Recipe extraction failed")
                    );
                    break;

                  case "cancelled":
                    console.log("[URLUpload] Extraction cancelled");

                    // Only close if this is still the current EventSource
                    if (eventSourceRef.current === eventSource) {
                      eventSource.close();
                      eventSourceRef.current = null;
                      console.log(
                        "[URLUpload] Closed EventSource after cancellation"
                      );
                    }

                    reject(new Error("Recipe extraction was cancelled"));
                    break;

                  case "timeout":
                    console.warn(
                      "[URLUpload] Extraction timeout:",
                      data.message
                    );

                    // Only close if this is still the current EventSource
                    if (eventSourceRef.current === eventSource) {
                      eventSource.close();
                      eventSourceRef.current = null;
                      console.log(
                        "[URLUpload] Closed EventSource after timeout"
                      );
                    }

                    reject(
                      new Error(data.message || "Recipe extraction timed out")
                    );
                    break;
                }
              } catch (error) {
                console.error("Error parsing SSE data:", error);
              }
            };

            eventSource.onerror = (error) => {
              console.error("[URLUpload] SSE connection error:", error);

              // Only cleanup if this is still the current EventSource
              // This prevents orphaned handlers from interfering
              if (eventSourceRef.current === eventSource) {
                eventSource.close();
                eventSourceRef.current = null;
                console.log("[URLUpload] Cleaned up EventSource after error");
              } else {
                console.warn(
                  "[URLUpload] Orphaned EventSource error handler called, ignoring"
                );
              }

              reject(new Error("Lost connection to extraction service"));
            };
          });
        } else {
          // Use polling for compatibility
          const pollInterval = 2000; // Poll every 2 seconds
          const maxPolls = 60; // Max 2 minutes of polling
          let pollCount = 0;

          while (pollCount < maxPolls) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval));

            // Check if component is still mounted
            if (!isMountedRef.current) {
              break;
            }

            // Get task status
            const statusResponse = await fetch(
              `/api/recipes/import/url/${taskId}`
            );

            if (!statusResponse.ok) {
              if (statusResponse.status === 404) {
                // Task not found yet, continue polling
                pollCount++;
                continue;
              }
              throw new Error("Failed to get task status");
            }

            const statusResult = await statusResponse.json();

            // Update UI with real progress
            if (isMountedRef.current) {
              setUploadState((prev) => ({
                ...prev,
                status: "polling",
                progress: statusResult.progress || prev.progress,
                message: statusResult.message || prev.message,
                currentStep: statusResult.currentStep,
                currentUrl: statusResult.currentUrl,
              }));
            }

            // Check if task is complete
            if (
              statusResult.status === "completed" ||
              statusResult.status === "finished"
            ) {
              // Task completed successfully
              if (isMountedRef.current) {
                setUploadState((prev) => ({
                  ...prev,
                  status: "success",
                  progress: 100,
                  message: t("status.complete"),
                }));
              }

              // Return the extracted recipe data
              if (statusResult.data) {
                return {
                  title: statusResult.data.title || "Imported Recipe",
                  description: statusResult.data.description || "",
                  ingredients: statusResult.data.ingredients || [],
                  instructions: statusResult.data.instructions || [],
                  prepTime: statusResult.data.prepTime,
                  cookTime: statusResult.data.cookTime,
                  servings: statusResult.data.servings || 4,
                  difficulty: statusResult.data.difficulty,
                  cuisine: statusResult.data.cuisine,
                  tags: statusResult.data.tags || [],
                  calories: statusResult.data.calories,
                  protein: statusResult.data.protein,
                  carbs: statusResult.data.carbs,
                  fat: statusResult.data.fat,
                  imageUrl: statusResult.data.imageUrl,
                };
              }

              return null;
            }

            // Check if task failed or stopped
            if (
              statusResult.status === "failed" ||
              statusResult.status === "stopped"
            ) {
              throw new Error(
                statusResult.message ||
                  statusResult.error ||
                  "Recipe extraction failed. Please check the URL and try again."
              );
            }

            // Check if task was cancelled
            if (statusResult.status === "cancelled") {
              throw new Error("Recipe extraction was cancelled");
            }

            pollCount++;
          }

          // Polling timeout
          throw new Error(
            "Recipe extraction is taking longer than expected. Please try again."
          );
        }
      } catch (error) {
        console.error("[URLUpload] URL processing error:", error);

        // Clean up EventSource if error occurred
        if (eventSourceRef.current) {
          try {
            eventSourceRef.current.close();
            console.log(
              "[URLUpload] Closed EventSource after processing error"
            );
          } catch (closeError) {
            console.warn("[URLUpload] Error closing EventSource:", closeError);
          }
          eventSourceRef.current = null;
        }

        // Clean up AbortController if error occurred
        if (abortControllerRef.current) {
          try {
            abortControllerRef.current.abort();
          } catch (abortError) {
            console.warn("[URLUpload] Error aborting requests:", abortError);
          }
          abortControllerRef.current = null;
        }

        throw error; // Pass the error up for better handling
      }
    },
    [t, useSSE] // Add useSSE to dependencies
  );

  // Handle URL processing
  const processURL = useCallback(
    async (url: string) => {
      if (isMountedRef.current) {
        setUploadState((prev) => ({
          ...prev,
          status: "validating",
          progress: 0,
          message: t("status.validating"),
          url,
        }));
      }

      try {
        // Validate the URL
        const validation = validateURL(url);
        if (!validation.isValid) {
          if (isMountedRef.current) {
            setUploadState((prev) => ({
              ...prev,
              status: "error",
              progress: 0,
              message: validation.error || t("errors.validationFailed"),
            }));
          }
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
        const errorMessage = getErrorMessage(error);
        if (isMountedRef.current) {
          setUploadState((prev) => ({
            ...prev,
            status: "error",
            progress: 0,
            message: errorMessage,
          }));
        }
        onUploadError?.(errorMessage);
        toast.error(errorMessage);

        // If it's a cancelled error, don't show the error alert
        if (errorMessage.includes("cancelled")) {
          if (isMountedRef.current) {
            setUploadState((prev) => ({
              ...prev,
              status: "idle",
              progress: 0,
              message: "",
            }));
          }
        }
      }
    },
    [
      t,
      validateURL,
      fetchURLAndProcess,
      onURLUploaded,
      onUploadError,
      getErrorMessage,
    ] // Keep necessary dependencies
  );

  // Handle form submission - wrap in useCallback to prevent recreation
  const handleSubmit = useCallback(
    async (data: UrlFormData) => {
      await processURL(data.url);
    },
    [processURL]
  );

  // Handle form errors
  const onFormError = useCallback((errors: { url?: { message?: string } }) => {
    if (errors.url?.message) {
      toast.error(errors.url.message);
    }
  }, []);

  // Cancel the current extraction task
  const cancelExtraction = useCallback(async () => {
    if (!uploadState.taskId) return;

    try {
      // Close EventSource if it exists
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Cancel the task via API
      const response = await fetch(
        `/api/recipes/import/url/${uploadState.taskId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        console.error("Failed to cancel task");
      }

      // Reset state
      setUploadState({
        status: "idle",
        progress: 0,
        message: "",
      });

      toast.info(t("extractionCancelled"));
    } catch (error) {
      console.error("Error cancelling extraction:", error);
      toast.error(t("errors.cancelFailed"));
    }
  }, [uploadState.taskId, t]);

  // Reset upload state
  const resetUpload = useCallback(() => {
    console.log("[URLUpload] Resetting upload state");

    // Clean up EventSource if it exists
    if (eventSourceRef.current) {
      try {
        eventSourceRef.current.close();
        console.log("[URLUpload] Closed EventSource during reset");
      } catch (error) {
        console.warn(
          "[URLUpload] Error closing EventSource during reset:",
          error
        );
      }
      eventSourceRef.current = null;
    }

    // Clean up AbortController if it exists
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
        console.log("[URLUpload] Aborted ongoing requests during reset");
      } catch (error) {
        console.warn(
          "[URLUpload] Error aborting requests during reset:",
          error
        );
      }
      abortControllerRef.current = null;
    }

    // Reset ALL state fields to ensure clean slate
    setUploadState({
      status: "idle",
      progress: 0,
      message: "",
      url: undefined,
      taskId: undefined,
      currentStep: undefined,
      currentUrl: undefined,
    });

    form.reset();
  }, [form]);

  // Render status icon
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
          uploadState.status === "error" && "border-red-500 bg-red-50"
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
                      {uploadState.message}
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
