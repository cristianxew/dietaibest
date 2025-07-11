/**
 * Server-Sent Events (SSE) API for Real-time Recipe Extraction Progress
 *
 * Provides live updates during Browser Use API recipe extraction:
 * - Progress percentage and status messages
 * - Task cancellation capabilities
 * - Automatic connection management
 * - Session-based authentication
 */

console.log("[SSE] Route file loaded - /api/progress/[taskId]/route.ts");

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import {
  TaskData,
  getTaskStatus,
  requestTaskCancellation,
  addTaskConnection,
  removeTaskConnection,
} from "@/lib/progress-tracker";

/**
 * GET /api/progress/[taskId] - Subscribe to task progress updates via SSE
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    console.log(`[SSE] GET request received for task: ${params.taskId}`);

    // Validate authentication
    const session = await getServerSession();
    if (!session?.user?.email) {
      console.warn(
        `[SSE] Unauthorized access attempt for task: ${params.taskId}`
      );
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { taskId } = params;
    const userId = session.user.email; // Using email as user ID

    console.log(
      `[SSE] Authenticated user ${userId} connecting to task: ${taskId}`
    );

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        console.log(
          `[SSE] Starting connection for task: ${taskId}, user: ${userId}`
        );

        // Add connection to task subscribers
        const connection = addTaskConnection(taskId, controller, userId);

        // Send initial connection message
        sendSSEMessage(controller, {
          type: "connected",
          taskId,
          timestamp: Date.now(),
        });

        // Send current task status if it exists
        const task = getTaskStatus(taskId);
        if (task) {
          console.log(
            `[SSE] Task found, sending current status: ${task.status} (${task.progress}%)`
          );
          sendTaskUpdate(controller, task);
        } else {
          console.warn(`[SSE] Task not found when connecting: ${taskId}`);
          sendSSEMessage(controller, {
            type: "error",
            message: "Task not found",
            taskId,
            timestamp: Date.now(),
          });
        }

        // Setup ping interval to keep connection alive
        const pingInterval = setInterval(() => {
          try {
            connection.lastPing = Date.now();
            sendSSEMessage(controller, {
              type: "ping",
              timestamp: Date.now(),
            });
          } catch {
            console.log(`[SSE] Ping failed, cleaning up connection`);
            clearInterval(pingInterval);
            removeTaskConnection(taskId, connection);
          }
        }, 30000); // Ping every 30 seconds

        // Cleanup on stream end
        request.signal.addEventListener("abort", () => {
          console.log(`[SSE] Connection aborted for task: ${taskId}`);
          clearInterval(pingInterval);
          removeTaskConnection(taskId, connection);
        });
      },

      cancel() {
        console.log(`[SSE] Stream cancelled for task: ${taskId}`);
      },
    });

    // Return SSE response with proper headers
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control",
      },
    });
  } catch (error) {
    console.error("[SSE] Setup error:", error);
    return new NextResponse("SSE setup failed", { status: 500 });
  }
}

/**
 * POST /api/progress/[taskId] - Cancel task
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    // Validate authentication
    const session = await getServerSession();
    if (!session?.user?.email) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { taskId } = params;
    const userId = session.user.email;
    const { action } = await request.json();

    if (action === "cancel") {
      const success = requestTaskCancellation(taskId, userId);
      return NextResponse.json({
        success,
        message: success
          ? "Task cancellation requested"
          : "Task not found or unauthorized",
      });
    }

    return new NextResponse("Invalid action", { status: 400 });
  } catch (error) {
    console.error("[SSE] Cancel task error:", error);
    return new NextResponse("Cancel task failed", { status: 500 });
  }
}

/**
 * Send SSE message to client
 */
function sendSSEMessage(
  controller: ReadableStreamDefaultController,
  data: Record<string, unknown>
) {
  try {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    controller.enqueue(new TextEncoder().encode(message));
  } catch (error) {
    console.error("[SSE] Failed to send message:", error);
  }
}

/**
 * Send task progress update via SSE
 */
function sendTaskUpdate(
  controller: ReadableStreamDefaultController,
  task: TaskData
) {
  sendSSEMessage(controller, {
    type: "task_update",
    taskId: task.taskId,
    status: task.status,
    progress: task.progress,
    message: task.message,
    timestamp: Date.now(),
  });
}
