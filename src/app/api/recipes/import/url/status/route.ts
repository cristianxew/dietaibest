import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import {
  getBrowserUseClient,
  BrowserUseError,
  type ExtendedTaskStatus,
  type BrowserUseTaskStep,
} from "@/lib/browser-use";
import type { ImportedRecipe } from "@/types/recipe";

/**
 * Server-Sent Events endpoint for real-time task status updates
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get task ID from query params
    const taskId = request.nextUrl.searchParams.get("taskId");
    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      );
    }

    // Create a TransformStream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const browserUseClient = getBrowserUseClient();
        let pollCount = 0;
        const maxPolls = 120; // Max 4 minutes of polling (2s intervals)
        let lastStatus = "";
        let lastProgress = 0;

        try {
          // Send initial connection message
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "connected",
                message: "Connected to task status stream",
              })}\n\n`
            )
          );

          // Poll for task status
          while (pollCount < maxPolls) {
            try {
              const taskStatus = await browserUseClient.getTaskStatus(taskId);

              // Calculate what to send to client
              const currentProgress = taskStatus.progress || 0;
              const steps = taskStatus.steps || [];
              const currentStep = steps.length;
              const lastStep = steps[steps.length - 1];

              // Prepare status update
              const statusUpdate = {
                type: "status",
                taskId,
                status: taskStatus.status,
                progress: currentProgress,
                currentStep,
                totalEstimatedSteps: 12, // Typical recipe extraction
                message: getStatusMessage(taskStatus, lastStep),
                currentUrl: lastStep?.url,
                currentAction: lastStep?.nextGoal,
              };

              // Only send update if something changed
              if (
                taskStatus.status !== lastStatus ||
                currentProgress !== lastProgress
              ) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(statusUpdate)}\n\n`)
                );
                lastStatus = taskStatus.status;
                lastProgress = currentProgress;
              }

              // Check if task is complete
              if (
                taskStatus.status === "completed" ||
                taskStatus.status === "finished"
              ) {
                try {
                  // Always try to parse the recipe data first
                  const recipeData: ImportedRecipe = browserUseClient.parseRecipeData(
                    taskStatus.output || taskStatus.result,
                    lastStep?.url || ""
                  );

                  // Validate if we got meaningful recipe data
                  const hasValidData =
                    recipeData &&
                    recipeData.title &&
                    recipeData.title.trim().length > 0 &&
                    Array.isArray(recipeData.ingredients) &&
                    recipeData.ingredients.length > 0 &&
                    Array.isArray(recipeData.instructions) &&
                    recipeData.instructions.length > 0;

                  if (hasValidData) {
                    // We have valid recipe data, return success regardless of isSuccess flag
                    console.log(`[SSE Status] Task completed successfully with valid data`);
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: "complete",
                          status: "success",
                          progress: 100,
                          message: "Recipe extraction completed successfully",
                          data: recipeData,
                        })}\n\n`
                      )
                    );

                    controller.close();
                    return;
                  }

                  // No valid recipe data found - send error
                  const errorMessage =
                    taskStatus.error ||
                    taskStatus.errorDetails ||
                    "Recipe extraction completed but failed to extract valid data. The website may not contain a proper recipe.";

                  console.log(`[SSE Status] Task completed but no valid data found:`, errorMessage);

                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "error",
                        status: "failed",
                        message: errorMessage,
                      })}\n\n`
                    )
                  );

                  controller.close();
                  return;
                } catch (parseError) {
                  console.error("[SSE Status] Error parsing recipe data:", parseError);
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "error",
                        status: "failed",
                        message: "Failed to parse recipe data",
                      })}\n\n`
                    )
                  );
                  controller.close();
                  return;
                }
              }

              // Check if task failed or stopped
              if (taskStatus.status === "failed" || taskStatus.status === "stopped") {
                // Get detailed error message
                const errorMessage =
                  taskStatus.errorDetails ||
                  taskStatus.error ||
                  (taskStatus.status === "stopped"
                    ? "Recipe extraction stopped due to consecutive failures. The website may be too complex, have anti-bot protection, or the recipe format is not supported."
                    : "Recipe extraction failed. Please check the URL and try again.");

                console.error(`[SSE Status] Task ${taskId} ${taskStatus.status}:`, errorMessage);

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

              // Check if task was cancelled
              if (taskStatus.status === "cancelled") {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "cancelled",
                      status: "cancelled",
                      message: "Recipe extraction was cancelled",
                    })}\n\n`
                  )
                );

                controller.close();
                return;
              }

              // Wait before next poll
              await new Promise((resolve) => setTimeout(resolve, 2000));
              pollCount++;
            } catch (error) {
              // Handle 404 as task not ready yet
              if (error instanceof BrowserUseError && error.status === 404) {
                // Send waiting message
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "status",
                      status: "pending",
                      progress: 5,
                      message: "Initializing extraction task...",
                    })}\n\n`
                  )
                );

                await new Promise((resolve) => setTimeout(resolve, 3000));
                pollCount++;
                continue;
              }

              // For other errors, send error message and close
              console.error("[SSE Status] Error polling task:", error);
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
          }

          // Polling timeout
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "timeout",
                message:
                  "Task is taking longer than expected. Please check back later.",
              })}\n\n`
            )
          );

          controller.close();
        } catch (error) {
          console.error("[SSE Status] Stream error:", error);
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

    // Return SSE response
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable Nginx buffering
      },
    });
  } catch (error) {
    console.error("[SSE Status] Route error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      { status: 500 }
    );
  }
}

// Helper function to generate user-friendly status messages
function getStatusMessage(
  taskStatus: ExtendedTaskStatus,
  lastStep: BrowserUseTaskStep | undefined
): string {
  const steps = taskStatus.steps?.length || 0;

  if (taskStatus.status === "pending") {
    return "Preparing browser automation...";
  }

  if (taskStatus.status === "running" || taskStatus.status === "started") {
    // Use the next goal from the last step if available
    if (lastStep?.nextGoal) {
      // Clean up the message for better UX
      const goal = lastStep.nextGoal;

      if (goal.toLowerCase().includes("navigate") || goal.toLowerCase().includes("go to")) {
        return "Navigating to recipe page...";
      }
      if (goal.toLowerCase().includes("wait") || goal.toLowerCase().includes("load")) {
        return "Waiting for page to load completely...";
      }
      if (goal.toLowerCase().includes("close") || goal.toLowerCase().includes("dismiss") || goal.toLowerCase().includes("popup")) {
        return "Handling popups and overlays...";
      }
      if (goal.toLowerCase().includes("extract") || goal.toLowerCase().includes("recipe")) {
        return "Extracting recipe information...";
      }
      if (goal.toLowerCase().includes("ingredient")) {
        return "Extracting ingredients list...";
      }
      if (goal.toLowerCase().includes("instruction") || goal.toLowerCase().includes("step")) {
        return "Extracting cooking instructions...";
      }
      if (goal.toLowerCase().includes("nutrition")) {
        return "Extracting nutritional information...";
      }

      // Return cleaned up goal message
      return goal.length > 60 ? goal.substring(0, 57) + "..." : goal;
    }

    // Fallback messages based on step count
    if (steps === 0) return "Starting browser automation...";
    if (steps <= 2) return "Navigating to recipe page...";
    if (steps <= 4) return "Page loading, please wait...";
    if (steps <= 6) return "Processing page content...";
    if (steps <= 8) return "Extracting recipe details...";
    if (steps <= 10) return "Gathering ingredients and instructions...";
    if (steps <= 12) return "Extracting additional information...";
    return "Finalizing extraction...";
  }

  if (taskStatus.status === "completed" || taskStatus.status === "finished") {
    return "Recipe extraction completed successfully!";
  }

  if (taskStatus.status === "failed") {
    return taskStatus.error || "Recipe extraction failed";
  }

  if (taskStatus.status === "cancelled") {
    return "Recipe extraction was cancelled";
  }

  return "Processing recipe...";
}