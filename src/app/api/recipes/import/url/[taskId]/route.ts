import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import {
  getBrowserUseClient,
  type ExtendedTaskStatus,
} from "@/lib/browser-use";
import type { ImportedRecipe } from "@/types/recipe";

// Get task status and result
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskId } = await params;

    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      );
    }

    try {
      const browserUseClient = getBrowserUseClient();
      const taskStatus = await browserUseClient.getTaskStatus(taskId);

      // Check if task failed or stopped
      if (taskStatus.status === "failed" || taskStatus.status === "stopped") {
        const errorMessage =
          taskStatus.errorDetails ||
          taskStatus.error ||
          (taskStatus.status === "stopped"
            ? "Recipe extraction stopped due to consecutive failures. The website may be too complex, have anti-bot protection, or the recipe format is not supported."
            : "Recipe extraction failed. Please check the URL and try again.");

        console.error(
          `[Recipe Import Status] Task ${taskId} ${taskStatus.status}:`,
          errorMessage
        );

        return NextResponse.json({
          taskId,
          status: taskStatus.status,
          progress: 0,
          message: errorMessage,
          error: errorMessage,
          steps: taskStatus.steps,
        });
      }

      // If task is completed, also return the parsed recipe data
      if (
        taskStatus.status === "completed" ||
        taskStatus.status === "finished"
      ) {
        try {
          // Always try to parse the recipe data first
          const recipeData: ImportedRecipe = browserUseClient.parseRecipeData(
            taskStatus.output || taskStatus.result,
            taskStatus.startUrl || ""
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
            console.log(`[Recipe Import] Task ${taskId} completed successfully with valid data`);
            return NextResponse.json({
              taskId,
              status: taskStatus.status,
              progress: taskStatus.progress || 100,
              message: "Recipe extraction completed",
              data: recipeData,
              steps: taskStatus.steps,
            });
          }

          // No valid recipe data found - check if there's an error message
          const errorMessage =
            taskStatus.error ||
            taskStatus.errorDetails ||
            "Recipe extraction completed but failed to extract valid data. The website may not contain a proper recipe.";

          console.log(`[Recipe Import] Task ${taskId} completed but no valid data found:`, errorMessage);

          return NextResponse.json({
            taskId,
            status: "failed",
            progress: 0,
            message: errorMessage,
            error: errorMessage,
            steps: taskStatus.steps,
          });
        } catch (parseError) {
          console.error(`[Recipe Import] Error parsing recipe data for task ${taskId}:`, parseError);
          return NextResponse.json({
            taskId,
            status: "failed",
            progress: 0,
            message: "Failed to parse recipe data",
            error: "Failed to parse recipe data",
            steps: taskStatus.steps,
          });
        }
      }

      // Return current status with progress information
      return NextResponse.json({
        taskId,
        status: taskStatus.status,
        progress: taskStatus.progress || calculateProgress(taskStatus),
        message: getStatusMessage(taskStatus),
        currentStep: taskStatus.steps?.length || 0,
        currentUrl: getCurrentUrl(taskStatus),
        steps: taskStatus.steps,
      });
    } catch (error) {
      console.error("[Recipe Import Status] Browser Use error:", error);

      // Handle 404 specifically
      if (error instanceof Error && error.message.includes("404")) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      return NextResponse.json(
        {
          error: "Failed to get task status",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Recipe Import Status] Route error:", error);
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

// Helper function to calculate progress based on task status
function calculateProgress(taskStatus: ExtendedTaskStatus): number {
  if (taskStatus.status === "pending") return 5;
  if (taskStatus.status === "running" || taskStatus.status === "started") {
    const steps = taskStatus.steps?.length || 0;
    // Assume typical recipe extraction takes about 10-15 steps
    const estimatedTotalSteps = 12;
    const progress = Math.min(
      95,
      Math.round((steps / estimatedTotalSteps) * 100)
    );
    return Math.max(10, progress); // At least 10% if running
  }
  if (taskStatus.status === "completed" || taskStatus.status === "finished")
    return 100;
  if (taskStatus.status === "failed" || taskStatus.status === "cancelled")
    return 0;
  return 0;
}

// Helper function to get user-friendly status message
function getStatusMessage(taskStatus: ExtendedTaskStatus): string {
  const steps = taskStatus.steps?.length || 0;
  const lastStep = taskStatus.steps?.[steps - 1];

  if (taskStatus.status === "pending") {
    return "Preparing to extract recipe...";
  }

  if (taskStatus.status === "running" || taskStatus.status === "started") {
    if (lastStep?.nextGoal) {
      return lastStep.nextGoal;
    }

    if (steps === 0) return "Starting browser automation...";
    if (steps <= 2) return "Navigating to recipe page...";
    if (steps <= 4) return "Waiting for page to load...";
    if (steps <= 6) return "Handling popups and overlays...";
    if (steps <= 10) return "Extracting recipe information...";
    return "Finalizing extraction...";
  }

  if (taskStatus.status === "completed" || taskStatus.status === "finished") {
    return "Recipe extraction completed successfully";
  }

  if (taskStatus.status === "failed") {
    return taskStatus.error || "Recipe extraction failed";
  }

  if (taskStatus.status === "cancelled") {
    return "Recipe extraction was cancelled";
  }

  return "Processing...";
}

// Helper function to get current URL from task status
function getCurrentUrl(taskStatus: ExtendedTaskStatus): string | undefined {
  const steps = taskStatus.steps;
  if (!steps || steps.length === 0) return undefined;

  const lastStep = steps[steps.length - 1];
  return lastStep?.url || undefined;
}

// Delete endpoint for task cancellation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskId } = await params;

    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      );
    }

    try {
      const browserUseClient = getBrowserUseClient();
      await browserUseClient.cancelTask(taskId);

      return NextResponse.json({
        taskId,
        message: "Task cancelled successfully",
      });
    } catch (error) {
      console.error("[Recipe Import Cancel] Browser Use error:", error);
      return NextResponse.json(
        {
          error: "Failed to cancel task",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Recipe Import Cancel] Route error:", error);
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
