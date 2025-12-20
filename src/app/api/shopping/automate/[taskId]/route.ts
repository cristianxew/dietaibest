import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getBrowserUseClient, SupportedStore } from "@/lib/browser-use";

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

// ============================================================================
// DELETE Handler - Cancel Shopping Automation Task
// ============================================================================

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
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

    console.log(`[Shopping Cancel] Cancelling task: ${taskId}`);

    try {
      const browserUseClient = getBrowserUseClient();
      await browserUseClient.cancelTask(taskId);

      console.log(`[Shopping Cancel] Task cancelled: ${taskId}`);

      return NextResponse.json({
        taskId,
        message: "Shopping automation cancelled successfully",
      });
    } catch (error) {
      console.error("[Shopping Cancel] Browser Use error:", error);
      return NextResponse.json(
        {
          error: "Failed to cancel task",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Shopping Cancel] Route error:", error);
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

// ============================================================================
// GET Handler - Polling Fallback for Task Status
// ============================================================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskId } = await params;
    const store =
      (request.nextUrl.searchParams.get("store") as SupportedStore) || "auchan";

    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      );
    }

    try {
      const browserUseClient = getBrowserUseClient();
      const taskStatus = await browserUseClient.getTaskStatus(taskId);

      // Calculate progress for shopping (more steps than recipe)
      let progress = 0;
      if (taskStatus.status === "pending") {
        progress = 5;
      } else if (
        taskStatus.status === "running" ||
        taskStatus.status === "started"
      ) {
        const steps = taskStatus.steps?.length || 0;
        progress = Math.min(95, Math.max(10, Math.round((steps / 50) * 100)));
      } else if (
        taskStatus.status === "completed" ||
        taskStatus.status === "finished"
      ) {
        progress = 100;
      }

      // If completed, parse the result
      if (
        taskStatus.status === "completed" ||
        taskStatus.status === "finished"
      ) {
        try {
          const shoppingResult = browserUseClient.parseShoppingResult(
            taskStatus.output || taskStatus.result,
            store
          );
          return NextResponse.json({
            taskId,
            status: "completed",
            progress: 100,
            message: "Shopping automation completed",
            data: shoppingResult,
          });
        } catch (parseError) {
          return NextResponse.json({
            taskId,
            status: "failed",
            progress: 0,
            message: "Failed to parse shopping results",
            error:
              parseError instanceof Error ? parseError.message : "Parse error",
          });
        }
      }

      // Return current status
      return NextResponse.json({
        taskId,
        status: taskStatus.status,
        progress,
        message: taskStatus.error || "Processing...",
        steps: taskStatus.steps?.length || 0,
      });
    } catch (error) {
      console.error("[Shopping Status] Error:", error);
      return NextResponse.json(
        { error: "Failed to get task status" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Shopping Status] Route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
