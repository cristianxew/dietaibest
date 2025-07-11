/**
 * Progress Tracking Utility Functions
 *
 * Shared functions for managing task progress across different API routes.
 */

// Active extraction tasks
const activeTasks = new Map<
  string,
  {
    taskId: string;
    userId: string;
    status:
      | "starting"
      | "extracting"
      | "processing"
      | "completed"
      | "cancelled"
      | "failed";
    progress: number;
    message: string;
    startedAt: number;
    cancelRequested?: boolean;
    lastUpdate: number;
    result?: unknown; // Store the final result data
  }
>();

// SSE connections for each task
const taskConnections = new Map<
  string,
  Set<{
    controller: ReadableStreamDefaultController;
    userId: string;
    lastPing: number;
  }>
>();

/**
 * Task data interface
 */
export interface TaskData {
  taskId: string;
  userId: string;
  status:
    | "starting"
    | "extracting"
    | "processing"
    | "completed"
    | "cancelled"
    | "failed";
  progress: number;
  message: string;
  startedAt: number;
  cancelRequested?: boolean;
  lastUpdate: number;
  result?: unknown; // Store the final result data
}

/**
 * Generate unique task ID
 */
export function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create new task and broadcast initial status
 */
export function createTask(
  taskId: string,
  userId: string,
  message: string = "Starting extraction..."
): TaskData {
  const task: TaskData = {
    taskId,
    userId,
    status: "starting",
    progress: 0,
    message,
    startedAt: Date.now(),
    lastUpdate: Date.now(),
  };

  activeTasks.set(taskId, task);
  broadcastTaskUpdate(task);

  console.log(
    `[SSE] Created task: ${taskId} for user: ${userId}. Total active tasks: ${activeTasks.size}`
  );
  return task;
}

/**
 * Update task progress and broadcast to subscribers
 */
export function updateTaskProgress(
  taskId: string,
  progress: number,
  message: string,
  status?:
    | "starting"
    | "extracting"
    | "processing"
    | "completed"
    | "cancelled"
    | "failed",
  result?: unknown
) {
  const task = activeTasks.get(taskId);
  if (!task) {
    console.warn(
      `[SSE] Task not found: ${taskId}. Active tasks: ${Array.from(
        activeTasks.keys()
      ).join(", ")}`
    );
    return;
  }

  console.log(
    `[SSE] Updating task ${taskId}: ${progress}% - ${message} (status: ${
      status || "no change"
    })`
  );

  // Check if cancellation was requested
  if (task.cancelRequested && status !== "cancelled") {
    return; // Don't update if cancellation is pending
  }

  task.progress = Math.max(0, Math.min(100, progress));
  task.message = message;
  task.lastUpdate = Date.now();
  if (status) {
    task.status = status;
  }
  if (result !== undefined) {
    task.result = result;
  }

  broadcastTaskUpdate(task);

  // Clean up completed/failed tasks after a delay
  if (status === "completed" || status === "failed" || status === "cancelled") {
    setTimeout(() => {
      console.log(`[SSE] Cleaning up completed task: ${taskId}`);
      activeTasks.delete(taskId);
      taskConnections.delete(taskId);
    }, 10000); // Keep for 10 seconds for final status
  }
}

/**
 * Broadcast task update to all subscribers
 */
function broadcastTaskUpdate(task: TaskData) {
  const connections = taskConnections.get(task.taskId);
  if (!connections) {
    console.log(`[SSE] No connections found for task: ${task.taskId}`);
    return;
  }

  console.log(
    `[SSE] Broadcasting update to ${connections.size} connections for task: ${task.taskId}`
  );

  // Send update to all connected clients for this task
  for (const connection of connections) {
    try {
      sendTaskUpdate(connection.controller, task);
    } catch (error) {
      console.error("[SSE] Failed to broadcast update:", error);
      connections.delete(connection);
    }
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
  const updateData: {
    type: string;
    taskId: string;
    status: string;
    progress: number;
    message: string;
    timestamp: number;
    result?: unknown;
  } = {
    type: "task_update",
    taskId: task.taskId,
    status: task.status,
    progress: task.progress,
    message: task.message,
    timestamp: Date.now(),
  };

  // Include result data when task is completed
  if (task.status === "completed" && task.result) {
    updateData.result = task.result;
  }

  sendSSEMessage(controller, updateData);
}

/**
 * Check if task cancellation was requested
 */
export function isTaskCancelled(taskId: string): boolean {
  const task = activeTasks.get(taskId);
  return task?.cancelRequested === true;
}

/**
 * Get task status
 */
export function getTaskStatus(taskId: string): TaskData | null {
  return activeTasks.get(taskId) || null;
}

/**
 * Request task cancellation
 */
export function requestTaskCancellation(
  taskId: string,
  userId: string
): boolean {
  const task = activeTasks.get(taskId);
  if (task && task.userId === userId) {
    task.cancelRequested = true;
    task.status = "cancelled";
    task.lastUpdate = Date.now();

    console.log(`[SSE] Cancellation requested for task: ${taskId}`);

    // Notify all subscribers
    broadcastTaskUpdate(task);

    // Clean up task after a delay
    setTimeout(() => {
      activeTasks.delete(taskId);
      taskConnections.delete(taskId);
    }, 5000);

    return true;
  }
  return false;
}

/**
 * Add SSE connection for a task
 */
export function addTaskConnection(
  taskId: string,
  controller: ReadableStreamDefaultController,
  userId: string
) {
  if (!taskConnections.has(taskId)) {
    taskConnections.set(taskId, new Set());
  }

  const connection = {
    controller,
    userId,
    lastPing: Date.now(),
  };

  taskConnections.get(taskId)?.add(connection);
  console.log(
    `[SSE] Added connection for task: ${taskId}. Total connections: ${
      taskConnections.get(taskId)?.size
    }`
  );

  return connection;
}

/**
 * Remove SSE connection for a task
 */
export function removeTaskConnection(
  taskId: string,
  connection: {
    controller: ReadableStreamDefaultController;
    userId: string;
    lastPing: number;
  }
) {
  taskConnections.get(taskId)?.delete(connection);

  // Clean up empty task connection sets
  if (taskConnections.get(taskId)?.size === 0) {
    taskConnections.delete(taskId);
  }

  console.log(
    `[SSE] Removed connection for task: ${taskId}. Remaining connections: ${
      taskConnections.get(taskId)?.size || 0
    }`
  );
}

/**
 * Get all active tasks (for debugging)
 */
export function getActiveTasks(): Map<string, TaskData> {
  return activeTasks;
}

/**
 * Clean up stale tasks and connections
 */
function cleanupStaleTasks() {
  const now = Date.now();
  const staleTimeout = 10 * 60 * 1000; // 10 minutes

  for (const [taskId, task] of activeTasks.entries()) {
    if (now - task.lastUpdate > staleTimeout) {
      console.log(`[SSE] Cleaning up stale task: ${taskId}`);
      activeTasks.delete(taskId);
      taskConnections.delete(taskId);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupStaleTasks, 5 * 60 * 1000);
