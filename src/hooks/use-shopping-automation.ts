"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ShoppingAutomationResult, ShoppingItemResult } from "@/lib/browser-use";
import { SupportedStore } from "@/types/shopping-preferences";
import { startShoppingTask, ShoppingAutomationInput } from "@/actions/shopping-automation";

// ============================================================================
// Types
// ============================================================================

export type ShoppingAutomationStatus =
  | "idle"
  | "connecting"
  | "running"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled"
  | "timeout";

export interface ShoppingProgress {
  status: ShoppingAutomationStatus;
  progress: number;
  currentStep: number;
  totalEstimatedSteps: number;
  message: string;
  currentUrl?: string;
  currentAction?: string;
}

export interface ShoppingAutomationState {
  status: ShoppingAutomationStatus;
  progress: ShoppingProgress;
  result: ShoppingAutomationResult | null;
  error: string | null;
  taskId: string | null;
  store: SupportedStore | null;
  /** Live URL to access the browser session with cart state */
  liveUrl: string | null;
  /** Browser session ID for tracking */
  browserSessionId: string | null;
}

export interface UseShoppingAutomationReturn {
  state: ShoppingAutomationState;
  startAutomation: (input: ShoppingAutomationInput) => Promise<void>;
  cancelAutomation: () => Promise<void>;
  retryFailedItems: (failedItems: ShoppingItemResult[]) => Promise<void>;
  reset: () => void;
  isLoading: boolean;
  isComplete: boolean;
  isError: boolean;
}

// ============================================================================
// Initial State
// ============================================================================

const initialProgress: ShoppingProgress = {
  status: "idle",
  progress: 0,
  currentStep: 0,
  totalEstimatedSteps: 50,
  message: "",
  currentUrl: undefined,
  currentAction: undefined,
};

const initialState: ShoppingAutomationState = {
  status: "idle",
  progress: initialProgress,
  result: null,
  error: null,
  taskId: null,
  store: null,
  liveUrl: null,
  browserSessionId: null,
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useShoppingAutomation(): UseShoppingAutomationReturn {
  const [state, setState] = useState<ShoppingAutomationState>(initialState);

  // Refs for cleanup and preventing state updates after unmount
  const isMountedRef = useRef(true);
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize isMountedRef on mount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      // Cleanup EventSource on unmount
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      // Cleanup AbortController
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Helper to safely update state only if mounted
  const safeSetState = useCallback(
    (updater: ShoppingAutomationState | ((prev: ShoppingAutomationState) => ShoppingAutomationState)) => {
      if (isMountedRef.current) {
        setState(updater);
      }
    },
    []
  );

  // Cleanup function for SSE connection
  const cleanupConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Start SSE connection to track progress
  const startSSEConnection = useCallback(
    (taskId: string, store: SupportedStore) => {
      // Cleanup any existing connection
      cleanupConnection();

      const sseUrl = `/api/shopping/automate/status?taskId=${taskId}&store=${store}`;
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        if (!isMountedRef.current) return;

        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "connected":
              safeSetState((prev) => ({
                ...prev,
                status: "running",
                progress: {
                  ...prev.progress,
                  status: "running",
                  message: data.message || "Connected to automation service",
                },
              }));
              break;

            case "status":
              safeSetState((prev) => ({
                ...prev,
                status: "running",
                progress: {
                  status: "running",
                  progress: data.progress || 0,
                  currentStep: data.currentStep || 0,
                  totalEstimatedSteps: data.totalEstimatedSteps || 50,
                  message: data.message || "Processing...",
                  currentUrl: data.currentUrl,
                  currentAction: data.currentAction,
                },
              }));
              break;

            case "complete":
              safeSetState((prev) => ({
                ...prev,
                status: data.data?.status === "partial" ? "partial" : "completed",
                progress: {
                  ...prev.progress,
                  status: data.data?.status === "partial" ? "partial" : "completed",
                  progress: 100,
                  message: data.message || "Automation completed!",
                },
                result: data.data || null,
              }));
              cleanupConnection();
              break;

            case "error":
              safeSetState((prev) => ({
                ...prev,
                status: "failed",
                progress: {
                  ...prev.progress,
                  status: "failed",
                  message: data.message || "An error occurred",
                },
                error: data.message || "Shopping automation failed",
              }));
              cleanupConnection();
              break;

            case "cancelled":
              safeSetState((prev) => ({
                ...prev,
                status: "cancelled",
                progress: {
                  ...prev.progress,
                  status: "cancelled",
                  message: "Automation was cancelled",
                },
              }));
              cleanupConnection();
              break;

            case "timeout":
              safeSetState((prev) => ({
                ...prev,
                status: "timeout",
                progress: {
                  ...prev.progress,
                  status: "timeout",
                  message: data.message || "Automation timed out",
                },
                error: data.message || "Automation timed out",
              }));
              cleanupConnection();
              break;
          }
        } catch (parseError) {
          console.error("[useShoppingAutomation] Failed to parse SSE data:", parseError);
        }
      };

      eventSource.onerror = () => {
        if (!isMountedRef.current) return;

        // EventSource errors don't contain much info, check readyState
        const readyState = eventSource.readyState;
        let errorMessage = "Connection lost. Please try again.";

        if (readyState === EventSource.CLOSED) {
          errorMessage = "Connection closed unexpectedly. The server may be unavailable.";
        } else if (readyState === EventSource.CONNECTING) {
          // Still trying to connect, might recover
          console.warn("[useShoppingAutomation] SSE reconnecting...");
          return;
        }

        console.error("[useShoppingAutomation] SSE connection error. ReadyState:", readyState);
        safeSetState((prev) => ({
          ...prev,
          status: "failed",
          progress: {
            ...prev.progress,
            status: "failed",
            message: errorMessage,
          },
          error: errorMessage,
        }));
        cleanupConnection();
      };
    },
    [cleanupConnection, safeSetState]
  );

  // Start automation
  const startAutomation = useCallback(
    async (input: ShoppingAutomationInput) => {
      // Cleanup any existing connection
      cleanupConnection();

      // Set connecting state
      safeSetState({
        ...initialState,
        status: "connecting",
        store: input.store,
        progress: {
          ...initialProgress,
          status: "connecting",
          message: "Starting shopping automation...",
        },
      });

      try {
        console.log("[useShoppingAutomation] Starting automation with input:", {
          store: input.store,
          itemCount: input.items.length,
        });

        // Start the shopping task via server action
        const result = await startShoppingTask(input);

        console.log("[useShoppingAutomation] Server action result:", result);

        if (!isMountedRef.current) return;

        if (result.error || !result.data?.taskId) {
          const errorMsg = result.error || "Failed to start automation";
          console.error("[useShoppingAutomation] Failed to start task:", errorMsg);
          safeSetState((prev) => ({
            ...prev,
            status: "failed",
            progress: {
              ...prev.progress,
              status: "failed",
              message: errorMsg,
            },
            error: errorMsg,
          }));
          return;
        }

        console.log("[useShoppingAutomation] Task started successfully:", {
          taskId: result.data.taskId,
          liveUrl: result.data.liveUrl,
          browserSessionId: result.data.browserSessionId,
        });

        // Update state with taskId and liveUrl
        safeSetState((prev) => ({
          ...prev,
          taskId: result.data!.taskId,
          store: result.data!.store as SupportedStore,
          liveUrl: result.data!.liveUrl || null,
          browserSessionId: result.data!.browserSessionId || null,
          status: "running",
          progress: {
            ...prev.progress,
            status: "running",
            message: "Automation started, connecting to progress stream...",
          },
        }));

        // Start SSE connection for progress tracking
        startSSEConnection(result.data.taskId, result.data.store as SupportedStore);
      } catch (error) {
        if (!isMountedRef.current) return;

        console.error("[useShoppingAutomation] Exception during start:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to start automation";
        safeSetState((prev) => ({
          ...prev,
          status: "failed",
          progress: {
            ...prev.progress,
            status: "failed",
            message: errorMessage,
          },
          error: errorMessage,
        }));
      }
    },
    [cleanupConnection, safeSetState, startSSEConnection]
  );

  // Cancel automation
  const cancelAutomation = useCallback(async () => {
    const { taskId } = state;

    if (!taskId) {
      cleanupConnection();
      safeSetState((prev) => ({
        ...prev,
        status: "cancelled",
        progress: {
          ...prev.progress,
          status: "cancelled",
          message: "Automation cancelled",
        },
      }));
      return;
    }

    try {
      // Call the cancel API
      const response = await fetch(`/api/shopping/automate/${taskId}`, {
        method: "DELETE",
      });

      if (!isMountedRef.current) return;

      if (!response.ok) {
        console.warn("[useShoppingAutomation] Failed to cancel task on server");
      }

      cleanupConnection();
      safeSetState((prev) => ({
        ...prev,
        status: "cancelled",
        progress: {
          ...prev.progress,
          status: "cancelled",
          message: "Automation cancelled",
        },
      }));
    } catch (error) {
      console.error("[useShoppingAutomation] Error cancelling automation:", error);
      cleanupConnection();
      safeSetState((prev) => ({
        ...prev,
        status: "cancelled",
        progress: {
          ...prev.progress,
          status: "cancelled",
          message: "Automation cancelled",
        },
      }));
    }
  }, [state, cleanupConnection, safeSetState]);

  // Retry failed items
  const retryFailedItems = useCallback(
    async (failedItems: ShoppingItemResult[]) => {
      if (failedItems.length === 0 || !state.store) return;

      // Convert failed items back to input format
      const retryInput: ShoppingAutomationInput = {
        store: state.store,
        items: failedItems.map((item) => ({
          name: item.name,
          amount: item.requestedAmount,
          unit: item.requestedUnit,
        })),
      };

      await startAutomation(retryInput);
    },
    [state.store, startAutomation]
  );

  // Reset state
  const reset = useCallback(() => {
    cleanupConnection();
    safeSetState(initialState);
  }, [cleanupConnection, safeSetState]);

  // Computed values
  const isLoading = state.status === "connecting" || state.status === "running";
  const isComplete = state.status === "completed" || state.status === "partial";
  const isError = state.status === "failed" || state.status === "timeout";

  return {
    state,
    startAutomation,
    cancelAutomation,
    retryFailedItems,
    reset,
    isLoading,
    isComplete,
    isError,
  };
}
