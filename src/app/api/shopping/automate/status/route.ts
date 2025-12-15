import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import {
  getBrowserUseClient,
  BrowserUseError,
  ExtendedTaskStatus,
  BrowserUseTaskStep,
  SupportedStore,
} from "@/lib/browser-use";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ============================================================================
// GET Handler - SSE Stream for Shopping Automation Status
// ============================================================================

export async function GET(request: NextRequest) {
  // Authentication check
  const session = await getServerSession();
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get taskId and store from query params
  const searchParams = request.nextUrl.searchParams;
  const taskId = searchParams.get("taskId");
  const store = searchParams.get("store") as SupportedStore | null;

  if (!taskId) {
    return new Response(JSON.stringify({ error: "Task ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const browserUseClient = getBrowserUseClient();

  const stream = new ReadableStream({
    async start(controller) {
      let pollCount = 0;
      const maxPolls = 200; // ~10 minutes at 3s intervals (shopping takes longer)
      let lastStatus = "";
      let lastProgress = 0;

      try {
        // Send initial connection message
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "connected",
              message: "Connected to shopping automation status stream",
            })}\n\n`
          )
        );

        while (pollCount < maxPolls) {
          try {
            const taskStatus = await browserUseClient.getTaskStatus(taskId);
            const steps = taskStatus.steps || [];
            const lastStep = steps[steps.length - 1];
            const currentProgress = taskStatus.progress || 0;

            // Only send update if status or progress changed
            if (
              taskStatus.status !== lastStatus ||
              currentProgress !== lastProgress
            ) {
              const statusUpdate = {
                type: "status",
                taskId,
                status: taskStatus.status,
                progress: currentProgress,
                currentStep: steps.length,
                totalEstimatedSteps: 50, // Shopping has more steps
                message: getShoppingStatusMessage(taskStatus, lastStep),
                currentUrl: lastStep?.url,
                currentAction: lastStep?.nextGoal,
              };

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(statusUpdate)}\n\n`)
              );
              lastStatus = taskStatus.status;
              lastProgress = currentProgress;
            }

            // Handle completion
            if (
              taskStatus.status === "completed" ||
              taskStatus.status === "finished"
            ) {
              try {
                const shoppingResult = browserUseClient.parseShoppingResult(
                  taskStatus.output || taskStatus.result,
                  store || "auchan"
                );

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "complete",
                      status: "success",
                      progress: 100,
                      message: "Shopping automation completed successfully",
                      data: shoppingResult,
                    })}\n\n`
                  )
                );
                controller.close();
                return;
              } catch (parseError) {
                console.error(
                  "[Shopping SSE] Error parsing result:",
                  parseError
                );
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "error",
                      status: "failed",
                      message: "Failed to parse shopping results",
                    })}\n\n`
                  )
                );
                controller.close();
                return;
              }
            }

            // Handle failure
            if (
              taskStatus.status === "failed" ||
              taskStatus.status === "stopped"
            ) {
              const errorMessage =
                taskStatus.errorDetails ||
                taskStatus.error ||
                "Shopping automation failed. The store website may have blocked automation.";

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "error",
                    status: taskStatus.status,
                    message: errorMessage,
                  })}\n\n`
                )
              );
              controller.close();
              return;
            }

            // Handle cancellation
            if (taskStatus.status === "cancelled") {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "cancelled",
                    status: "cancelled",
                    message: "Shopping automation was cancelled",
                  })}\n\n`
                )
              );
              controller.close();
              return;
            }
          } catch (error) {
            // Handle 404 as task not ready yet
            if (error instanceof BrowserUseError && error.status === 404) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "status",
                    status: "pending",
                    progress: 5,
                    message: "Initializing shopping automation...",
                  })}\n\n`
                )
              );
              await new Promise((resolve) => setTimeout(resolve, 3000));
              pollCount++;
              continue;
            }

            console.error("[Shopping SSE] Error polling task:", error);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "error",
                  message:
                    error instanceof Error
                      ? error.message
                      : "Failed to get task status",
                })}\n\n`
              )
            );
            controller.close();
            return;
          }

          // Wait 3 seconds between polls (shopping is slower)
          await new Promise((resolve) => setTimeout(resolve, 3000));
          pollCount++;
        }

        // Timeout
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "timeout",
              message:
                "Shopping automation is taking longer than expected. Please check back later.",
            })}\n\n`
          )
        );
        controller.close();
      } catch (error) {
        console.error("[Shopping SSE] Stream error:", error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "error",
              message:
                error instanceof Error
                  ? error.message
                  : "An unexpected error occurred",
            })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

function getShoppingStatusMessage(
  taskStatus: ExtendedTaskStatus,
  lastStep: BrowserUseTaskStep | undefined
): string {
  const steps = taskStatus.steps?.length || 0;

  if (taskStatus.status === "pending") {
    return "Preparing shopping automation...";
  }

  if (taskStatus.status === "running" || taskStatus.status === "started") {
    if (lastStep?.nextGoal) {
      const goal = lastStep.nextGoal.toLowerCase();

      if (goal.includes("navigate") || goal.includes("go to")) {
        return "Navigating to store website...";
      }
      if (
        goal.includes("cookie") ||
        goal.includes("popup") ||
        goal.includes("consent")
      ) {
        return "Handling cookie consent...";
      }
      if (goal.includes("search") || goal.includes("szukaj")) {
        return "Searching for products...";
      }
      if (
        goal.includes("add") ||
        goal.includes("cart") ||
        goal.includes("koszyk")
      ) {
        return "Adding items to cart...";
      }
      if (goal.includes("quantity") || goal.includes("ilość")) {
        return "Adjusting quantities...";
      }
      if (goal.includes("price") || goal.includes("cena")) {
        return "Checking prices...";
      }

      return lastStep.nextGoal.length > 60
        ? lastStep.nextGoal.substring(0, 57) + "..."
        : lastStep.nextGoal;
    }

    // Fallback messages based on step count
    if (steps === 0) return "Starting browser automation...";
    if (steps <= 3) return "Opening store website...";
    if (steps <= 6) return "Handling popups and overlays...";
    if (steps <= 15) return "Searching for products...";
    if (steps <= 30) return "Adding items to cart...";
    if (steps <= 40) return "Reviewing cart contents...";
    return "Finalizing shopping cart...";
  }

  if (taskStatus.status === "completed" || taskStatus.status === "finished") {
    return "Shopping automation completed!";
  }

  if (taskStatus.status === "failed") {
    return taskStatus.error || "Shopping automation failed";
  }

  if (taskStatus.status === "cancelled") {
    return "Shopping automation was cancelled";
  }

  return "Processing shopping list...";
}
