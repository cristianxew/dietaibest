import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import type { ImportedRecipe } from "@/types/recipe";

export type ExtractionState = {
  status:
    | "idle"
    | "validating"
    | "starting"
    | "polling"
    | "processing"
    | "success"
    | "error"
    | "cancelled";
  progress: number;
  message: string;
  url?: string;
  taskId?: string;
  currentStep?: number;
  currentUrl?: string;
};

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 60;

export function useRecipeErrorTranslation() {
  const t = useTranslations("recipes.urlUpload");

  return useCallback(
    (error: unknown): string => {
      const errorRaw = error instanceof Error ? error.message : String(error);
      const errorStr = errorRaw.toLowerCase();

      if (
        errorStr.includes("consecutive failures") ||
        errorStr.includes("stopped")
      ) {
        return t("errors.consecutiveFailures");
      }

      if (errorStr.includes("404") || errorStr.includes("not found")) {
        return t("errors.taskNotFound");
      }

      if (
        errorStr.includes("timeout") ||
        errorStr.includes("timed out") ||
        errorStr.includes("taking longer than expected") ||
        errorStr.includes("took too long")
      ) {
        return t("errors.timeout");
      }

      if (errorStr.includes("cancelled")) {
        return t("errors.cancelled");
      }

      if (
        errorStr.includes("network") ||
        errorStr.includes("fetch") ||
        errorStr.includes("connection")
      ) {
        return t("errors.network");
      }

      if (
        errorStr.includes("authentication") ||
        errorStr.includes("unauthorized")
      ) {
        return t("errors.unauthorized");
      }

      if (errorStr.includes("validation") || errorStr.includes("invalid")) {
        return t("errors.validation");
      }

      if (
        errorStr.includes("recipe") &&
        errorStr.includes("not") &&
        (errorStr.includes("found") || errorStr.includes("contain"))
      ) {
        return t("errors.noRecipe");
      }

      if (errorStr.includes("popup") || errorStr.includes("overlay")) {
        return t("errors.blocked");
      }

      if (
        errorStr.includes("anti-bot") ||
        errorStr.includes("captcha") ||
        errorStr.includes("protection")
      ) {
        return t("errors.antiBot");
      }

      if (errorRaw.length > 20 && errorRaw.length < 200) {
        return errorRaw;
      }

      return t("errors.processingFailed");
    },
    [t],
  );
}

export function useRecipeExtraction() {
  const getErrorMessage = useRecipeErrorTranslation();

  const [state, setState] = useState<ExtractionState>({
    status: "idle",
    progress: 0,
    message: "",
  });

  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const rejectPromiseRef = useRef<((err: Error) => void) | null>(null);
  const taskIdRef = useRef<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (rejectPromiseRef.current) {
        rejectPromiseRef.current(new Error("Component unmounted"));
        rejectPromiseRef.current = null;
      }
    };
  }, []);

  const cancel = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (rejectPromiseRef.current) {
      rejectPromiseRef.current(new Error("Extraction cancelled"));
      rejectPromiseRef.current = null;
    }

    if (isMountedRef.current) {
      setState((prev) => ({
        ...prev,
        status: "cancelled",
        message: "Extraction cancelled",
      }));
    }

    if (taskIdRef.current) {
      try {
        await fetch(`/api/recipes/import/url/${taskIdRef.current}`, {
          method: "DELETE",
        });
      } catch {
        // Ignore cancellation errors
      }
    }
  }, []);

  const extract = useCallback(
    async (url: string): Promise<ImportedRecipe> => {
      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          status: "starting",
          url,
          progress: 0,
          message: "Starting extraction...",
        }));
      }

      abortControllerRef.current = new AbortController();
      taskIdRef.current = null;

      try {
        const response = await fetch("/api/recipes/import/url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (response.status === 403) {
            // Surface the structured payload so callers can open the paywall
            throw Object.assign(
              new Error("entitlement_violation"),
              { payload: errorData },
            );
          }
          throw new Error(errorData.error || "Failed to start extraction");
        }

        const { taskId } = await response.json();
        taskIdRef.current = taskId;

        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            taskId,
            status: "polling",
            progress: 5,
            message: "Extracting recipe...",
          }));
        }

        return new Promise<ImportedRecipe>((resolve, reject) => {
          rejectPromiseRef.current = reject;

          let pollCount = 0;

          const executePoll = async () => {
            while (pollCount < MAX_POLLS) {
              await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

              if (
                !isMountedRef.current ||
                rejectPromiseRef.current !== reject
              ) {
                return;
              }

              try {
                const statusResponse = await fetch(
                  `/api/recipes/import/url/${taskId}`,
                  { signal: abortControllerRef.current?.signal },
                );

                if (statusResponse.status === 404) {
                  pollCount++;
                  continue; // transient error, try again
                }

                if (!statusResponse.ok) {
                  throw new Error(
                    `Failed to fetch status: ${statusResponse.status}`,
                  );
                }

                const statusResult = await statusResponse.json();

                if (isMountedRef.current) {
                  setState((prev) => ({
                    ...prev,
                    progress: statusResult.progress,
                    message: statusResult.message,
                    currentStep: statusResult.currentStep,
                    currentUrl: statusResult.currentUrl,
                  }));
                }

                if (
                  statusResult.status === "completed" ||
                  statusResult.status === "finished"
                ) {
                  if (isMountedRef.current) {
                    setState((prev) => ({
                      ...prev,
                      status: "success",
                      progress: 100,
                      message: statusResult.message || "Extraction complete",
                    }));
                  }
                  rejectPromiseRef.current = null;
                  resolve(statusResult.data as ImportedRecipe);
                  return;
                }

                if (
                  statusResult.status === "failed" ||
                  statusResult.status === "stopped" ||
                  statusResult.status === "cancelled"
                ) {
                  throw new Error(
                    statusResult.message || "Extraction failed",
                  );
                }
              } catch (error) {
                if ((error as Error).name === "AbortError") {
                  return; // Request was aborted, stop polling
                }

                const translatedMsg = getErrorMessage(error);
                if (isMountedRef.current) {
                  setState((prev) => ({
                    ...prev,
                    status: "error",
                    message: translatedMsg,
                  }));
                }
                rejectPromiseRef.current = null;
                reject(new Error(translatedMsg));
                return;
              }

              pollCount++;
            }

            // Exceeded max polls
            const translatedMsg = getErrorMessage(
              "Recipe extraction took too long",
            );
            if (isMountedRef.current) {
              setState((prev) => ({
                ...prev,
                status: "error",
                message: translatedMsg,
              }));
            }
            rejectPromiseRef.current = null;
            reject(new Error(translatedMsg));
          };

          void executePoll();
        });
      } catch (error) {
        const translatedMsg = getErrorMessage(error);
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            status: "error",
            message: translatedMsg,
          }));
        }
        throw new Error(translatedMsg);
      }
    },
    [getErrorMessage],
  );

  const reset = useCallback(() => {
    cancel();
    if (isMountedRef.current) {
      setState({
        status: "idle",
        progress: 0,
        message: "",
      });
    }
  }, [cancel]);

  return { state, extract, cancel, reset };
}
