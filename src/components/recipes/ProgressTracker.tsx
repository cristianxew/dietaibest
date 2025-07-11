/**
 * Real-time Progress Tracker Component
 *
 * Connects to Server-Sent Events (SSE) to display live progress
 * during Browser Use API recipe extraction with cancellation support.
 */

"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { X, RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react";

interface ProgressData {
  taskId: string;
  status:
    | "starting"
    | "extracting"
    | "processing"
    | "completed"
    | "cancelled"
    | "failed";
  progress: number;
  message: string;
  timestamp: number;
}

interface ImportedRecipeData {
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
}

interface ProgressTrackerProps {
  taskId: string;
  onComplete?: (
    success: boolean,
    data?: {
      result?: ImportedRecipeData;
      message?: string;
      warnings?: string[];
    }
  ) => void;
  onCancel?: () => void;
  autoHide?: boolean;
  className?: string;
}

export function ProgressTracker({
  taskId,
  onComplete,
  onCancel,
  autoHide = false,
  className,
}: ProgressTrackerProps) {
  const [progress, setProgress] = useState<ProgressData>({
    taskId,
    status: "starting",
    progress: 0,
    message: "Initializing...",
    timestamp: Date.now(),
  });

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCount = useRef(0);

  // Connect to SSE endpoint
  const connectToSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource(`/api/progress/${taskId}`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log(`[ProgressTracker] Connected to task: ${taskId}`);
        setIsConnected(true);
        setError(null);
        retryCount.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "connected":
              console.log(`[ProgressTracker] SSE connection confirmed`);
              break;

            case "task_update":
              setProgress({
                taskId: data.taskId,
                status: data.status,
                progress: data.progress,
                message: data.message,
                timestamp: data.timestamp,
              });

              // Handle completion
              if (data.status === "completed") {
                onComplete?.(true, data);
                if (autoHide) {
                  setTimeout(() => setIsVisible(false), 3000);
                }
              } else if (data.status === "failed") {
                onComplete?.(false, data);
              } else if (data.status === "cancelled") {
                onCancel?.();
              }
              break;

            case "ping":
              // Keep-alive ping, no action needed
              break;

            case "error":
              setError(data.message);
              break;

            default:
              console.warn(
                `[ProgressTracker] Unknown message type: ${data.type}`
              );
          }
        } catch (parseError) {
          console.error(
            "[ProgressTracker] Failed to parse SSE message:",
            parseError
          );
        }
      };

      eventSource.onerror = () => {
        console.warn(
          `[ProgressTracker] SSE connection error for task: ${taskId}`
        );
        setIsConnected(false);

        // Implement exponential backoff for reconnection
        retryCount.current++;
        const retryDelay = Math.min(
          1000 * Math.pow(2, retryCount.current),
          30000
        ); // Max 30 seconds

        if (retryCount.current <= 5) {
          retryTimeoutRef.current = setTimeout(() => {
            console.log(
              `[ProgressTracker] Attempting reconnection ${retryCount.current}/5`
            );
            connectToSSE();
          }, retryDelay);
        } else {
          setError(
            "Connection lost. Please refresh the page to continue tracking."
          );
        }
      };
    } catch (connectError) {
      console.error(
        "[ProgressTracker] Failed to connect to SSE:",
        connectError
      );
      setError("Failed to connect to progress tracking");
    }
  }, [taskId, onComplete, onCancel, autoHide]);

  // Cancel extraction task
  const handleCancel = async () => {
    try {
      const response = await fetch(`/api/progress/${taskId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "cancel" }),
      });

      if (response.ok) {
        console.log(
          `[ProgressTracker] Cancellation requested for task: ${taskId}`
        );
      } else {
        console.error(
          "[ProgressTracker] Failed to cancel task:",
          response.statusText
        );
        setError("Failed to cancel extraction");
      }
    } catch (cancelError) {
      console.error("[ProgressTracker] Cancel request error:", cancelError);
      setError("Failed to cancel extraction");
    }
  };

  // Retry connection
  const handleRetry = () => {
    setError(null);
    retryCount.current = 0;
    connectToSSE();
  };

  // Close progress tracker
  const handleClose = () => {
    setIsVisible(false);
  };

  // Setup SSE connection on mount
  useEffect(() => {
    connectToSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [connectToSSE]);

  // Don't render if hidden
  if (!isVisible) {
    return null;
  }

  // Get status icon
  const getStatusIcon = () => {
    switch (progress.status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "failed":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case "cancelled":
        return <X className="w-5 h-5 text-orange-500" />;
      default:
        return <Clock className="w-5 h-5 text-blue-500 animate-pulse" />;
    }
  };

  return (
    <Card className={`w-full max-w-md mx-auto ${className}`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="font-medium text-sm">Recipe Extraction</span>
            </div>

            <div className="flex items-center gap-1">
              {/* Connection status */}
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-green-500" : "bg-red-500"
                }`}
                title={isConnected ? "Connected" : "Disconnected"}
              />

              {/* Close button */}
              {(progress.status === "completed" ||
                progress.status === "failed" ||
                progress.status === "cancelled") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="h-6 w-6 p-0"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <Progress
              value={progress.progress}
              className="h-2"
              // className={`h-2 ${getProgressColor()}`}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progress.message}</span>
              <span>{progress.progress}%</span>
            </div>
          </div>

          {/* Error display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {error}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="ml-2 h-6 text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Action buttons */}
          <div className="flex justify-between">
            <div className="text-xs text-muted-foreground">
              Task ID: {taskId.slice(-8)}
            </div>

            {progress.status !== "completed" &&
              progress.status !== "failed" &&
              progress.status !== "cancelled" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
              )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ProgressTracker;
