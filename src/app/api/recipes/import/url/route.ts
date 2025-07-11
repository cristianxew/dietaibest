console.log(
  "[Recipe Import] Route file loaded - /api/recipes/import/url/route.ts"
);

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { getBrowserUseClient, BrowserUseError } from "@/lib/browser-use";
import {
  generateTaskId,
  createTask,
  updateTaskProgress,
  isTaskCancelled,
} from "@/lib/progress-tracker";

import { TaskStatus as BrowserUseTaskStatus } from "@/lib/browser-use";

// URL validation schema
const urlImportSchema = z.object({
  url: z
    .string()
    .url("Please enter a valid URL")
    .refine((url) => {
      try {
        const urlObj = new URL(url);
        // Only allow HTTP and HTTPS protocols
        return urlObj.protocol === "http:" || urlObj.protocol === "https:";
      } catch {
        return false;
      }
    }, "URL must start with http:// or https://")
    .refine((url) => {
      try {
        const urlObj = new URL(url);
        // Security: Block localhost and private IPs to prevent SSRF attacks
        const hostname = urlObj.hostname.toLowerCase();

        // Block localhost variations
        if (
          hostname === "localhost" ||
          hostname === "127.0.0.1" ||
          hostname === "0.0.0.0"
        ) {
          return false;
        }

        // Block private IP ranges (simplified check)
        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (ipPattern.test(hostname)) {
          const parts = hostname.split(".").map(Number);
          // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
          if (
            parts[0] === 10 ||
            (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
            (parts[0] === 192 && parts[1] === 168)
          ) {
            return false;
          }
        }

        return true;
      } catch {
        return false;
      }
    }, "URL is not allowed for security reasons"),
});

// Supported recipe websites (can be extended)
const SUPPORTED_DOMAINS = [
  "allrecipes.com",
  "foodnetwork.com",
  "bonappetit.com",
  "seriouseats.com",
  "epicurious.com",
  "food52.com",
  "cooking.nytimes.com",
  "tasty.co",
  "delish.com",
  "simplyrecipes.com",
  "bbcgoodfood.com",
  "minimalistbaker.com",
  "budgetbytes.com",
  "skinnytaste.com",
  "pinchofyum.com",
  "loveandlemons.com",
  "cookieandkate.com",
  "thekitchn.com",
  "smittenkitchen.com",
];

// Check if URL is from a supported domain
function isSupportedDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase().replace("www.", "");
    return SUPPORTED_DOMAINS.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Validate URL reachability with timeout
 */
async function validateUrlReachability(url: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch(url, {
      method: "HEAD", // Use HEAD to check reachability without downloading content
      signal: controller.signal,
      headers: {
        "User-Agent": "DietAIBest Recipe Importer/1.0",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`URL returned status ${response.status}`);
    }
  } catch (error) {
    clearTimeout(timeout);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error(
          "URL request timed out - the website might be slow or unavailable"
        );
      }
      throw new Error(`Cannot access URL: ${error.message}`);
    }
    throw new Error("Failed to validate URL accessibility");
  }
}

/**
 * Build an intelligent prompt for recipe extraction
 */
function buildRecipeExtractionPrompt(url: string): string {
  return `Navigate to ${url} and extract complete recipe information. 

IMPORTANT: Handle any pop-ups, cookie banners, or registration walls automatically.

Extract the following data in JSON format:
{
  "title": "Recipe title",
  "description": "Brief description", 
  "prepTime": minutes_as_number,
  "cookTime": minutes_as_number,
  "servings": number_of_servings,
  "difficulty": "easy|medium|hard",
  "ingredients": [
    {
      "name": "ingredient name",
      "amount": number,
      "unit": "measurement unit"
    }
  ],
  "instructions": ["step 1", "step 2", ...],
  "tags": ["category", "cuisine", ...],
  "calories": optional_number,
  "protein": optional_number_in_grams,
  "carbs": optional_number_in_grams, 
  "fat": optional_number_in_grams
}

Requirements:
- Navigate past any registration walls or pop-ups
- Handle dynamic content loading
- Extract from recipe cards, structured data, or recipe text
- If multiple recipes on page, extract the main/featured recipe
- Return only valid JSON, no additional text
- If recipe not found, return {"error": "No recipe found on this page"}`;
}

export async function POST(request: NextRequest) {
  console.log("[Recipe Import] POST request received");

  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user?.email) {
      console.log("[Recipe Import] Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[Recipe Import] Authenticated user: ${session.user.email}`);

    // Parse and validate request body
    const body = await request.json();
    const validation = urlImportSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { url } = validation.data;

    // Check if domain is supported (warning, not error)
    const isSupported = isSupportedDomain(url);

    // Generate unique task ID for progress tracking
    const taskId = generateTaskId();
    const userId = session.user.email;

    console.log(
      `[Recipe Import] Generated taskId: ${taskId} for user: ${userId}`
    );

    try {
      // Create task for progress tracking
      console.log(`[Recipe Import] Creating task: ${taskId}`);
      createTask(taskId, userId, "Initializing recipe extraction...");
      console.log(`[Recipe Import] Task created successfully: ${taskId}`);

      // Start extraction asynchronously
      (async () => {
        try {
          // Validate URL
          updateTaskProgress(taskId, 5, "Validating URL accessibility...");
          await validateUrlReachability(url);

          // Initialize client
          updateTaskProgress(taskId, 10, "Initializing Browser Use API...");
          const browserUseClient = getBrowserUseClient();

          // Build prompt
          const taskPrompt = buildRecipeExtractionPrompt(url);

          // Start Browser Use task
          updateTaskProgress(taskId, 15, "Starting extraction task...");
          const taskResponse = await browserUseClient.startTask({
            task: taskPrompt,
            save_browser_data: false,
          });

          const browserTaskId = taskResponse.id;

          updateTaskProgress(
            taskId,
            20,
            "Task started. Monitoring progress..."
          );

          // Poll status
          let attempts = 0;
          const maxAttempts = 90; // Up to ~3 minutes with backoff
          let delay = 2000; // Start with 2s delay

          while (attempts < maxAttempts) {
            if (isTaskCancelled(taskId)) {
              updateTaskProgress(taskId, 0, "Cancelling task...", "cancelled");
              await browserUseClient.stopTask(browserTaskId);
              updateTaskProgress(
                taskId,
                0,
                "Task cancelled by user",
                "cancelled"
              );
              return;
            }

            attempts++;
            let taskDetails: BrowserUseTaskStatus;

            try {
              // Use getTask to get full details including output/result
              taskDetails = await browserUseClient.getTask(browserTaskId);
            } catch (error) {
              if (error instanceof BrowserUseError && error.status === 404) {
                // Task not yet available - continue polling
                const progress = Math.min(95, (attempts / maxAttempts) * 100);
                updateTaskProgress(
                  taskId,
                  progress,
                  "Waiting for task to become available..."
                );
                await new Promise((resolve) => setTimeout(resolve, delay));
                delay = Math.min(delay * 1.2, 10000);
                continue;
              }
              throw error;
            }

            const progress = Math.min(95, (attempts / maxAttempts) * 100);
            updateTaskProgress(
              taskId,
              progress,
              `Status: ${taskDetails.status}${
                taskDetails.message ? " - " + taskDetails.message : ""
              }`
            );

            if (
              taskDetails.status === "completed" ||
              taskDetails.status === "finished"
            ) {
              updateTaskProgress(taskId, 95, "Fetching final results...");

              // We already have the full task details from getTask above
              const result = taskDetails.output || taskDetails.result;

              if (!result) {
                updateTaskProgress(
                  taskId,
                  0,
                  "Task completed but no recipe data was extracted",
                  "failed"
                );
                return;
              }

              try {
                // Parse the recipe data
                const recipeData = await browserUseClient.parseRecipeData(
                  result,
                  url
                );

                updateTaskProgress(
                  taskId,
                  100,
                  "Recipe extraction completed successfully",
                  "completed",
                  recipeData
                );
                return;
              } catch (parseError) {
                console.error(
                  "[Recipe Import] Failed to parse recipe data:",
                  parseError
                );
                updateTaskProgress(
                  taskId,
                  0,
                  parseError instanceof Error
                    ? parseError.message
                    : "Failed to parse recipe data",
                  "failed"
                );
                return;
              }
            }

            if (taskDetails.status === "failed") {
              updateTaskProgress(
                taskId,
                0,
                taskDetails.error || "Extraction failed",
                "failed"
              );
              return;
            }

            // Wait before next poll
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay = Math.min(delay * 1.2, 10000);
          }

          updateTaskProgress(taskId, 0, "Extraction timed out", "failed");
        } catch (error) {
          console.error("[Recipe Import] Extraction error:", error);
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error";
          updateTaskProgress(taskId, 0, `Error: ${errorMsg}`, "failed");
        }
      })();

      // Return task ID immediately for client-side tracking
      return NextResponse.json({
        taskId,
        message: "Recipe extraction started. Check progress for updates.",
        warnings: isSupported
          ? []
          : [
              "This website might not be fully supported. Extraction results may vary.",
            ],
      });
    } catch (error) {
      console.error("Recipe import error:", error);

      // Mark task as failed
      updateTaskProgress(taskId, 0, "Initialization failed", "failed");

      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to start recipe extraction",
          details:
            "Unable to initialize the extraction process. Please try again.",
          taskId,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Recipe import error:", error);

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
