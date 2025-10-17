/**
 * Browser Use API Client for Recipe Extraction (API v2)
 *
 * Simple client for extracting recipe data from URLs using Browser Use Cloud API v2.
 *
 * API v2 Changes:
 * - Enhanced request parameters: structuredOutput, vision, maxSteps, etc.
 *
 * @see https://docs.cloud.browser-use.com/api-reference/v-2-api-current/tasks/create-task-tasks-post
 */

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface BrowserUseConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
}

export interface RecipeExtractionRequest {
  url: string;
  options?: {
    waitForNetworkIdle?: boolean;
    handleAntiBot?: boolean;
    extractStructuredData?: boolean;
    timeout?: number;
  };
}

export interface BrowserUseTaskRequest {
  task: string;
  llm?:
    | "gpt-4.1"
    | "gpt-4.1-mini"
    | "o4-mini"
    | "o3"
    | "gemini-2.5-flash"
    | "gemini-2.5-pro"
    | "gemini-flash-latest"
    | "gemini-flash-lite-latest"
    | "claude-sonnet-4-20250514"
    | "gpt-4o"
    | "gpt-4o-mini"
    | "llama-4-maverick-17b-128e-instruct"
    | "claude-3-7-sonnet-20250219";
  startUrl?: string | null;
  maxSteps?: number;
  structuredOutput?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, string> | null;
  secrets?: Record<string, string> | null;
  allowedDomains?: string[] | null;
  highlightElements?: boolean;
  flashMode?: boolean;
  thinking?: boolean;
  vision?: boolean;
  systemPromptExtension?: string;
}

export interface BrowserUseTaskResponse {
  id: string;
}

export interface TaskStatus {
  id: string;
  status:
    | "pending"
    | "running"
    | "completed"
    | "finished"
    | "failed"
    | "cancelled";
  progress?: number;
  message?: string;
  result?: unknown;
  output?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ExtractedRecipeData {
  title: string;
  description: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: "easy" | "medium" | "hard";
  imageUrl: string;
  ingredients: Array<{
    name: string;
    amount: number;
    unit: string;
  }>;
  instructions: string[];
  tags: string[];
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  sourceUrl: string;
  extractedAt: string;
  confidence: number;
}

export class BrowserUseError extends Error {
  public code: string;
  public status?: number;
  public details?: unknown;

  constructor(
    code: string,
    message: string,
    status?: number,
    details?: unknown
  ) {
    super(message);
    this.name = "BrowserUseError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// ============================================================================
// Browser Use API Client
// ============================================================================

export class BrowserUseClient {
  private config: Required<BrowserUseConfig>;

  constructor(config: BrowserUseConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || "https://api.browser-use.com/api/v2",
      timeout: config.timeout || 120000, // 2 minutes default
      retryAttempts: config.retryAttempts || 3,
    };

    if (!this.config.apiKey) {
      throw new Error("Browser Use API key is required");
    }
  }

  // --------------------------------------------------------------------------
  // Core API Methods
  // --------------------------------------------------------------------------

  /**
   * Start a new Browser Use task for recipe extraction (API v2)
   */
  async startTask(
    request: BrowserUseTaskRequest
  ): Promise<BrowserUseTaskResponse> {
    const response = await this.makeRequest<BrowserUseTaskResponse>("/tasks", {
      method: "POST",
      body: JSON.stringify(request),
    });

    return response;
  }

  /**
   * Get full task details, including results (API v2)
   */
  async getTask(taskId: string): Promise<TaskStatus> {
    const response = await this.makeRequest<TaskStatus>(`/tasks/${taskId}`, {
      method: "GET",
    });

    return response;
  }

  // --------------------------------------------------------------------------
  // Recipe Extraction Methods
  // --------------------------------------------------------------------------

  /**
   * Extract recipe data from a URL using AI-powered browser automation (API v2)
   */
  async extractRecipeFromUrl(
    request: RecipeExtractionRequest
  ): Promise<ExtractedRecipeData> {
    const taskPrompt = this.buildRecipeExtractionPrompt(
      request.url,
      request.options
    );

    // Define structured output schema for better JSON responses
    const structuredOutputSchema = JSON.stringify({
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        prepTime: { type: "number" },
        cookTime: { type: "number" },
        servings: { type: "number" },
        difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
        imageUrl: { type: "string" },
        ingredients: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              amount: { type: "number" },
              unit: { type: "string" },
            },
            required: ["name", "amount", "unit"],
          },
        },
        instructions: { type: "array", items: { type: "string" } },
        tags: { type: "array", items: { type: "string" } },
        calories: { type: "number" },
        protein: { type: "number" },
        carbs: { type: "number" },
        fat: { type: "number" },
      },
      required: ["title", "ingredients", "instructions"],
    });

    // Start the extraction task with v2 parameters
    const taskResponse = await this.startTask({
      task: taskPrompt,
      llm: "gpt-4o",
      startUrl: request.url,
      thinking: true,
      maxSteps: 30,
      structuredOutput: structuredOutputSchema,
      vision: true,
      highlightElements: false,
    });

    // Poll for completion
    const result = await this.pollTaskCompletion(taskResponse.id);

    // Parse and validate the extracted data
    return this.parseRecipeData(result, request.url);
  }

  /**
   * Build an intelligent prompt for recipe extraction
   */
  private buildRecipeExtractionPrompt(
    url: string,
    options?: RecipeExtractionRequest["options"]
  ): string {
    const basePrompt = `Navigate to ${url} and extract complete recipe information. 

IMPORTANT: Handle any pop-ups, cookie banners, or registration walls automatically.

Extract the following data in JSON format:
{
  "title": "Recipe title",
  "description": "Brief description", 
  "prepTime": minutes_as_number,
  "cookTime": minutes_as_number,
  "servings": number_of_servings,
  "difficulty": "easy|medium|hard",
  "imageUrl": "recipe main image url",
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

    if (options?.waitForNetworkIdle) {
      return (
        basePrompt +
        "\n\nWait for all network activity to complete before extracting."
      );
    }

    return basePrompt;
  }

  /**
   * Poll task until completion with exponential backoff and 404 handling
   */
  private async pollTaskCompletion(
    taskId: string,
    maxAttempts: number = 60
  ): Promise<unknown> {
    let attempts = 0;
    let delay = 2000; // Start with 2 second delay
    const startTime = Date.now();
    const maxWaitTime = 10 * 60 * 1000; // 10 minutes maximum wait time

    // Initial delay to allow task to initialize
    await new Promise((resolve) => setTimeout(resolve, 1000));

    while (attempts < maxAttempts) {
      attempts++;

      // Check if we've exceeded maximum wait time
      if (Date.now() - startTime > maxWaitTime) {
        throw this.createError(
          "TASK_TIMEOUT",
          "Task polling exceeded maximum wait time of 10 minutes",
          408,
          { taskId, attempts, timeElapsed: Date.now() - startTime }
        );
      }

      try {
        const taskDetails = await this.getTask(taskId);

        if (
          taskDetails.status === "completed" ||
          taskDetails.status === "finished"
        ) {
          console.log(`[BrowserUse] Task ${taskId} completed successfully`);

          // Browser Use API returns results in 'output' field, not 'result'
          const resultData = taskDetails.output || taskDetails.result;
          return resultData;
        }

        if (taskDetails.status === "failed") {
          throw this.createError(
            "TASK_FAILED",
            taskDetails.error || "Task failed without error message",
            500,
            { taskId, status: taskDetails }
          );
        }

        if (taskDetails.status === "cancelled") {
          throw this.createError("TASK_CANCELLED", "Task was cancelled", 400, {
            taskId,
          });
        }

        // Task is still running, wait before next poll
        console.log(
          `[BrowserUse] Task ${taskId} status: ${taskDetails.status}, attempt ${attempts}/${maxAttempts}`
        );
      } catch (error) {
        if (error instanceof BrowserUseError && error.status === 404) {
          console.warn(
            `[BrowserUse] Task ${taskId} not found (404). Attempt: ${attempts}/${maxAttempts}. Will continue polling.`
          );
          // If we've been trying for over 3 minutes OR exceeded 18 attempts, fail
          if (attempts > 18 || Date.now() - startTime > 3 * 60 * 1000) {
            throw this.createError(
              "TASK_UNAVAILABLE",
              "Task could not be found after multiple attempts. It may have failed to create.",
              404,
              { taskId, attempts, timeElapsed: Date.now() - startTime }
            );
          }
          // Otherwise, just continue the loop and wait for the next poll.
        } else if (error instanceof BrowserUseError) {
          // Re-throw BrowserUse errors immediately - don't continue polling
          throw error;
        } else {
          // For network errors, continue polling but log the error
          console.warn(
            `[BrowserUse] Network error polling task ${taskId}:`,
            error
          );

          // If we've had too many network errors, fail
          if (attempts > maxAttempts / 2) {
            throw this.createError(
              "NETWORK_ERROR",
              "Too many network errors while polling task",
              500,
              {
                taskId,
                attempts,
                lastError:
                  error instanceof Error ? error.message : String(error),
              }
            );
          }
        }
      }

      // Wait before next poll (exponential backoff, max 10 seconds)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(delay, 10000))
      );
      delay = Math.min(delay * 1.2, 10000);
    }

    // If we exit the loop without returning, we've exceeded max attempts
    throw this.createError(
      "TASK_TIMEOUT",
      "Task polling timed out after maximum attempts. " +
        "The task may have completed successfully but took longer than expected. " +
        "Please check your Browser Use dashboard for the actual task status.",
      408,
      { taskId, attempts: maxAttempts, timeElapsed: Date.now() - startTime }
    );
  }

  /**
   * Parse and validate extracted recipe data
   */
  public parseRecipeData(
    result: unknown,
    sourceUrl: string
  ): ExtractedRecipeData {
    try {
      // Handle case where result is a string (JSON response)
      const data = typeof result === "string" ? JSON.parse(result) : result;

      if (data.error) {
        throw this.createError("EXTRACTION_FAILED", data.error, 422);
      }

      // Validate required fields
      const required = ["title", "ingredients", "instructions"];
      for (const field of required) {
        if (!data[field]) {
          throw this.createError(
            "INVALID_DATA",
            `Missing required field: ${field}`,
            422
          );
        }
      }

      // Calculate confidence score based on data completeness
      const confidence = this.calculateConfidence(data);

      return {
        title: String(data.title).trim(),
        description: String(data.description || "").trim(),
        prepTime: Number(data.prepTime) || 0,
        cookTime: Number(data.cookTime) || 0,
        servings: Number(data.servings) || 4,
        difficulty: this.validateDifficulty(data.difficulty),
        ingredients: this.validateIngredients(data.ingredients),
        instructions: this.validateInstructions(data.instructions),
        imageUrl: data.imageUrl || "",
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        calories: data.calories ? Number(data.calories) : undefined,
        protein: data.protein ? Number(data.protein) : undefined,
        carbs: data.carbs ? Number(data.carbs) : undefined,
        fat: data.fat ? Number(data.fat) : undefined,
        sourceUrl,
        extractedAt: new Date().toISOString(),
        confidence,
      };
    } catch (error) {
      if (error instanceof BrowserUseError) {
        throw error;
      }

      throw this.createError(
        "PARSE_ERROR",
        "Failed to parse extracted recipe data",
        422,
        {
          originalError: error instanceof Error ? error.message : String(error),
          result,
        }
      );
    }
  }

  // --------------------------------------------------------------------------
  // Validation & Utility Methods
  // --------------------------------------------------------------------------

  private validateDifficulty(difficulty: unknown): "easy" | "medium" | "hard" {
    const normalized = String(difficulty).toLowerCase();
    if (["easy", "medium", "hard"].includes(normalized)) {
      return normalized as "easy" | "medium" | "hard";
    }
    return "medium"; // Default fallback
  }

  private validateIngredients(
    ingredients: ExtractedRecipeData["ingredients"]
  ): ExtractedRecipeData["ingredients"] {
    if (!Array.isArray(ingredients)) {
      throw this.createError(
        "INVALID_DATA",
        "Ingredients must be an array",
        422
      );
    }

    return ingredients.map((ing, index) => {
      if (typeof ing === "string") {
        // Parse simple string format "2 cups flour"
        return this.parseIngredientString(ing);
      }

      return {
        name: String(ing.name || `Ingredient ${index + 1}`).trim(),
        amount: Number(ing.amount) || 1,
        unit: String(ing.unit || "unit").trim(),
      };
    });
  }

  private parseIngredientString(ingredient: string): {
    name: string;
    amount: number;
    unit: string;
  } {
    // Simple regex to extract "amount unit name" pattern
    const match = ingredient.match(/^(\d+(?:\.\d+)?)\s*(\w+)\s+(.+)$/);

    if (match) {
      return {
        amount: parseFloat(match[1]),
        unit: match[2],
        name: match[3].trim(),
      };
    }

    // Fallback for unparseable ingredients
    return {
      name: ingredient.trim(),
      amount: 1,
      unit: "unit",
    };
  }

  private validateInstructions(instructions: unknown[]): string[] {
    if (!Array.isArray(instructions)) {
      throw this.createError(
        "INVALID_DATA",
        "Instructions must be an array",
        422
      );
    }

    return instructions
      .map(String)
      .map((step) => step.trim())
      .filter((step) => step.length > 0);
  }

  private calculateConfidence(data: Record<string, unknown>): number {
    let score = 0;
    let maxScore = 0;

    // Required fields (40% of score)
    const requiredFields = ["title", "ingredients", "instructions"];
    requiredFields.forEach((field) => {
      maxScore += 40 / requiredFields.length;
      if (
        data[field] &&
        (Array.isArray(data[field])
          ? data[field].length > 0
          : String(data[field]).trim())
      ) {
        score += 40 / requiredFields.length;
      }
    });

    // Optional but valuable fields (60% of score)
    const optionalFields = [
      { field: "description", weight: 10 },
      { field: "prepTime", weight: 10 },
      { field: "cookTime", weight: 10 },
      { field: "servings", weight: 5 },
      { field: "difficulty", weight: 5 },
      { field: "calories", weight: 10 },
      { field: "protein", weight: 5 },
      { field: "carbs", weight: 5 },
    ];

    optionalFields.forEach(({ field, weight }) => {
      maxScore += weight;
      if (data[field] && String(data[field]).trim()) {
        score += weight;
      }
    });

    return Math.round((score / maxScore) * 100) / 100; // Round to 2 decimal places
  }

  // --------------------------------------------------------------------------
  // HTTP Client & Error Handling
  // --------------------------------------------------------------------------

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.timeout
        );

        const response = await fetch(url, {
          ...options,
          headers: {
            "X-Browser-Use-API-Key": this.config.apiKey,
            "Content-Type": "application/json",
            ...options.headers,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw this.createError(
            "API_ERROR",
            errorData.message || `HTTP ${response.status}`,
            response.status,
            errorData
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === this.config.retryAttempts) {
          break;
        }

        // Exponential backoff between retries
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  private createError(
    code: string,
    message: string,
    status?: number,
    details?: unknown
  ): BrowserUseError {
    return new BrowserUseError(code, message, status, details);
  }
}

// ============================================================================
// Exports & Factory Function
// ============================================================================

/**
 * Create a configured Browser Use client instance
 */
export function createBrowserUseClient(
  config?: Partial<BrowserUseConfig>
): BrowserUseClient {
  const apiKey = config?.apiKey || process.env.BROWSER_USE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Browser Use API key is required. Set BROWSER_USE_API_KEY environment variable."
    );
  }

  return new BrowserUseClient({
    apiKey,
    ...config,
  });
}

/**
 * Default client instance (singleton)
 */
let defaultClient: BrowserUseClient | null = null;

export function getBrowserUseClient(): BrowserUseClient {
  if (!defaultClient) {
    defaultClient = createBrowserUseClient();
  }
  return defaultClient;
}
