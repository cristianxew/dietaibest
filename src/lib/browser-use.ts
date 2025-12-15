/**
 * Browser Use API Client for Recipe Extraction & Shopping Automation (API v2)
 *
 * Client for:
 * - Extracting recipe data from URLs using Browser Use Cloud API v2
 * - Automating grocery shopping cart filling at supported Polish stores
 *
 * API v2 Changes:
 * - Enhanced request parameters: structuredOutput, vision, maxSteps, etc.
 *
 * @see https://docs.cloud.browser-use.com/api-reference/v-2-api-current/tasks/create-task-tasks-post
 */

import {
  transformShoppingItems,
  formatAsShoppingList,
} from "./shopping-item-transformer";

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
    | "claude-3-7-sonnet-20250219"
    | "browser-use-llm";
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
  vision?: boolean | "auto";
  systemPromptExtension?: string;
}

export interface BrowserUseTaskResponse {
  id: string;
  /** Session ID for shopping tasks (can be reused for follow-up tasks) */
  sessionId?: string;
}

/**
 * Browser session response from Browser-Use API
 * Used for persistent browser sessions that survive task completion
 */
export interface BrowserSessionResponse {
  id: string;
  status: "active" | "stopped";
  /** Live URL - direct access to the browser instance with session state */
  liveUrl: string;
  /** Chrome DevTools Protocol URL for advanced integrations */
  cdpUrl?: string;
  /** Timestamp when the session will auto-terminate */
  timeoutAt?: string;
  startedAt?: string;
  finishedAt?: string;
}

/**
 * Options for creating a browser session
 */
export interface CreateBrowserSessionOptions {
  /** Session timeout in seconds (default: 1800 = 30 minutes) */
  timeout?: number;
  /** Browser viewport width */
  browserScreenWidth?: number;
  /** Browser viewport height */
  browserScreenHeight?: number;
  /** Allow browser window resizing */
  allowResizing?: boolean;
}

export interface TaskStatus {
  id: string;
  status:
    | "pending"
    | "running"
    | "started" // Browser Use API v2 uses "started" instead of "running"
    | "paused"
    | "completed"
    | "finished"
    | "failed"
    | "stopped" // Browser Use API v2 uses "stopped" for failures
    | "cancelled";
  progress?: number;
  message?: string;
  result?: unknown;
  output?: unknown;
  error?: string;
  errorDetails?: string; // Additional error information
  isSuccess?: boolean; // Browser Use API v2 includes this
  startedAt?: string;
  completedAt?: string;
}

/**
 * Browser Use API v2 Task Step
 */
export interface BrowserUseTaskStep {
  stepNumber?: number;
  url?: string;
  screenshot?: string;
  previousGoalEvaluation?: string;
  nextGoal?: string;
  actions?: unknown[];
}

/**
 * Extended task details from Browser Use API v2
 * Includes additional fields not in the base TaskStatus interface
 */
export interface BrowserUseTaskDetails extends TaskStatus {
  steps?: BrowserUseTaskStep[];
  startUrl?: string;
  isSuccess?: boolean;
  errorDetails?: string;
  output?: unknown;
}

/**
 * Extended task status with computed progress
 */
export interface ExtendedTaskStatus extends BrowserUseTaskDetails {
  progress: number;
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

// ============================================================================
// Shopping Automation Types (Polish Stores)
// ============================================================================

/**
 * Supported grocery stores for shopping automation
 * Initial launch: Poland market
 */
export type SupportedStore = "auchan" | "frisco" | "carrefour";

/**
 * Store configuration with domain patterns and URLs
 */
export interface StoreConfig {
  id: SupportedStore;
  name: string;
  /** Domain patterns for allowedDomains parameter */
  domains: string[];
  /** Initial URL for the store */
  startUrl: string;
  /** Country code (ISO 3166-1 alpha-2) */
  country: string;
  /** Whether the store supports substitution suggestions */
  supportsSubstitutions: boolean;
}

/**
 * Pre-configured Polish grocery stores
 */
export const SUPPORTED_STORES: Record<SupportedStore, StoreConfig> = {
  auchan: {
    id: "auchan",
    name: "Auchan",
    domains: ["zakupy.auchan.pl", "*.auchan.pl"],
    startUrl: "https://zakupy.auchan.pl/",
    country: "PL",
    supportsSubstitutions: true,
  },
  frisco: {
    id: "frisco",
    name: "Frisco.pl",
    domains: ["frisco.pl", "www.frisco.pl"],
    startUrl: "https://www.frisco.pl/",
    country: "PL",
    supportsSubstitutions: true,
  },
  carrefour: {
    id: "carrefour",
    name: "Carrefour",
    domains: ["carrefour.pl", "*.carrefour.pl"],
    startUrl: "https://www.carrefour.pl/",
    country: "PL",
    supportsSubstitutions: true,
  },
};

/**
 * Individual item for shopping list
 */
export interface ShoppingListItem {
  name: string;
  amount: number;
  unit: string;
  category?: string;
  notes?: string;
}

/**
 * Request payload for shopping automation
 * Authentication is OPTIONAL - users can browse and add to cart without logging in
 */
export interface ShoppingAutomationRequest {
  store: SupportedStore;
  items: ShoppingListItem[];
  preferences?: {
    preferOrganic?: boolean;
    preferStoreBrand?: boolean;
    allowSubstitutions?: boolean;
    maxPricePerItem?: number;
  };
  /** Optional credentials - if not provided, will browse as guest */
  credentials?: {
    email?: string;
    // Password handled via secrets parameter if provided
  };
  /**
   * Indicates if user has stored credentials for this store.
   * When true, the agent will attempt to log in using credentials
   * passed via the secrets parameter before shopping.
   */
  hasStoredCredentials?: boolean;
}

/**
 * Result for an individual shopping item
 */
export interface ShoppingItemResult {
  name: string;
  requestedAmount: number;
  requestedUnit: string;
  status: "found" | "not_found" | "substituted" | "partial";
  foundProduct?: {
    name: string;
    price: number;
    quantity: number;
    unit: string;
    imageUrl?: string;
  };
  substitution?: {
    originalItem: string;
    substituteProduct: string;
    reason: string;
    priceDifference: number;
  };
}

/**
 * Complete result from shopping automation
 */
export interface ShoppingAutomationResult {
  status: "success" | "partial" | "failed";
  cartUrl?: string;
  /**
   * Live URL to access the browser session with cart state intact.
   * This URL lets users continue shopping or complete checkout
   * in the actual browser where the cart was filled.
   */
  liveUrl?: string;
  foundItems: ShoppingItemResult[];
  notFoundItems: ShoppingItemResult[];
  substitutions: ShoppingItemResult[];
  /** Total price in PLN */
  totalPrice?: number;
  /** Estimated tax in PLN */
  estimatedTax?: number;
  itemCount: number;
  store: SupportedStore;
  completedAt: string;
  errors?: string[];
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
  async getTask(taskId: string): Promise<BrowserUseTaskDetails> {
    const response = await this.makeRequest<BrowserUseTaskDetails>(
      `/tasks/${taskId}`,
      {
        method: "GET",
      }
    );

    return response;
  }

  // --------------------------------------------------------------------------
  // Recipe Extraction Methods
  // --------------------------------------------------------------------------

  /**
   * Start recipe extraction and return task ID immediately
   */
  async startRecipeExtraction(
    request: RecipeExtractionRequest
  ): Promise<{ taskId: string }> {
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
      llm: "browser-use-llm",
      startUrl: request.url,
      thinking: true,
      maxSteps: 30,
      structuredOutput: structuredOutputSchema,
      vision: true,
      highlightElements: false,
    });

    return { taskId: taskResponse.id };
  }

  /**
   * Get the current status of a task including steps and progress
   */
  async getTaskStatus(taskId: string): Promise<ExtendedTaskStatus> {
    try {
      const taskDetails = await this.getTask(taskId);

      // Log the raw response for debugging
      console.log(`[BrowserUse] Task ${taskId} status:`, {
        status: taskDetails.status,
        isSuccess: taskDetails.isSuccess,
        error: taskDetails.error,
        stepsCount: taskDetails.steps?.length || 0,
      });

      // Check if task has stopped or failed
      if (taskDetails.status === "stopped" || taskDetails.status === "failed") {
        // Extract detailed error information
        const errorDetails =
          taskDetails.errorDetails ||
          taskDetails.error ||
          "Task stopped due to consecutive failures";

        console.error(`[BrowserUse] Task ${taskId} failed:`, errorDetails);
      }

      // Calculate progress based on steps
      let progress = 0;
      if (taskDetails.status === "pending") {
        progress = 5;
      } else if (
        taskDetails.status === "running" ||
        taskDetails.status === "started"
      ) {
        const steps = taskDetails.steps?.length || 0;
        // Estimate based on typical recipe extraction (10-15 steps)
        progress = Math.min(95, Math.max(10, Math.round((steps / 12) * 100)));
      } else if (
        taskDetails.status === "completed" ||
        taskDetails.status === "finished"
      ) {
        // Also check isSuccess flag if available
        const isSuccess = taskDetails.isSuccess !== false;
        progress = isSuccess ? 100 : 0;
      } else if (
        taskDetails.status === "stopped" ||
        taskDetails.status === "failed"
      ) {
        progress = 0;
      }

      return {
        ...taskDetails,
        progress,
        // Ensure output is set from either output or result
        output: taskDetails.output || taskDetails.result,
      };
    } catch (error) {
      // If it's a 404, let it bubble up
      if (error instanceof BrowserUseError && error.status === 404) {
        throw error;
      }
      throw this.createError(
        "GET_TASK_ERROR",
        "Failed to get task status",
        500,
        { taskId, originalError: error }
      );
    }
  }

  /**
   * Cancel a running task
   */
  async cancelTask(taskId: string): Promise<void> {
    try {
      // Try to cancel the task by updating its status
      // Note: Browser Use API might not have a direct cancel endpoint,
      // so we may need to work around this
      await this.makeRequest(`/tasks/${taskId}`, {
        method: "DELETE",
      });
    } catch (error) {
      // If DELETE is not supported, try PATCH with cancelled status
      try {
        await this.makeRequest(`/tasks/${taskId}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "cancelled" }),
        });
      } catch {
        throw this.createError(
          "CANCEL_TASK_ERROR",
          "Failed to cancel task. The task may have already completed.",
          500,
          { taskId, originalError: error }
        );
      }
    }
  }

  // --------------------------------------------------------------------------
  // Browser Session Methods
  // --------------------------------------------------------------------------

  /**
   * Create a persistent browser session
   *
   * The session stays alive after tasks complete, allowing users to access
   * the browser via liveUrl and continue where the automation left off
   * (e.g., complete checkout after cart is filled).
   *
   * @param options Session configuration options
   * @returns Browser session with liveUrl for user access
   */
  async createBrowserSession(
    options?: CreateBrowserSessionOptions
  ): Promise<BrowserSessionResponse> {
    // Build request body with only the parameters we want to send
    // Only include optional params if they have values
    // Note: API limit is 240 seconds (4 minutes) max
    const requestBody: Record<string, unknown> = {
      timeout: Math.min(options?.timeout ?? 240, 240), // 4 minutes max (API limit)
    };

    // Only add screen dimensions if explicitly provided
    if (options?.browserScreenWidth) {
      requestBody.browserScreenWidth = options.browserScreenWidth;
    }
    if (options?.browserScreenHeight) {
      requestBody.browserScreenHeight = options.browserScreenHeight;
    }

    console.log("[BrowserUse] Creating browser session with options:", requestBody);

    try {
      const response = await this.makeRequest<BrowserSessionResponse>("/browsers", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      console.log("[BrowserUse] Browser session created:", {
        id: response.id,
        liveUrl: response.liveUrl,
        status: response.status,
      });

      return response;
    } catch (error) {
      // Log full error details for debugging
      const errorDetails = error instanceof BrowserUseError ? error.details : undefined;
      console.error("[BrowserUse] Failed to create browser session:", {
        message: error instanceof Error ? error.message : String(error),
        code: error instanceof BrowserUseError ? error.code : undefined,
        status: error instanceof BrowserUseError ? error.status : undefined,
        requestBody,
        errorDetails: JSON.stringify(errorDetails, null, 2),
      });
      throw error;
    }
  }

  /**
   * Stop/close a browser session
   */
  async closeBrowserSession(sessionId: string): Promise<void> {
    try {
      await this.makeRequest(`/browsers/${sessionId}`, {
        method: "DELETE",
      });
      console.log("[BrowserUse] Browser session closed:", sessionId);
    } catch (error) {
      console.warn("[BrowserUse] Failed to close browser session:", sessionId, error);
    }
  }

  /**
   * Get session information including liveUrl
   */
  async getSession(sessionId: string): Promise<{
    id: string;
    status: "active" | "stopped";
    liveUrl?: string;
    startedAt?: string;
    finishedAt?: string;
  }> {
    return this.makeRequest(`/sessions/${sessionId}`, {
      method: "GET",
    });
  }

  /**
   * Create a new Session (different from Browser Session)
   * Sessions are available on free tier and stay active for up to 15 minutes
   * The session's liveUrl allows users to access the hosted browser directly
   */
  async createSession(options?: {
    startUrl?: string;
    profileId?: string;
    proxyCountryCode?: string;
  }): Promise<{
    id: string;
    status: "active" | "stopped";
    liveUrl: string;
    startedAt?: string;
  }> {
    const requestBody = options || {};

    console.log("[BrowserUse] Creating session with options:", requestBody);

    const response = await this.makeRequest<{
      id: string;
      status: "active" | "stopped";
      liveUrl: string;
      startedAt?: string;
    }>("/sessions", {
      method: "POST",
      body: JSON.stringify(requestBody),
    });

    console.log("[BrowserUse] Session created:", {
      id: response.id,
      liveUrl: response.liveUrl,
      status: response.status,
    });

    return response;
  }

  /**
   * Extract recipe data from a URL using AI-powered browser automation (API v2)
   * @deprecated Use startRecipeExtraction and getTaskStatus for better UX
   */
  async extractRecipeFromUrl(
    request: RecipeExtractionRequest
  ): Promise<ExtractedRecipeData> {
    const { taskId } = await this.startRecipeExtraction(request);

    // Poll for completion
    const result = await this.pollTaskCompletion(taskId);

    // Parse and validate the extracted data
    return this.parseRecipeData(result, request.url);
  }

  // --------------------------------------------------------------------------
  // Shopping Automation Methods
  // --------------------------------------------------------------------------

  /**
   * Start shopping automation and return task ID immediately
   * Authentication is OPTIONAL - users can browse as guests
   *
   * Uses a persistent browser session created FIRST so users can access the cart
   * via liveUrl after automation completes. The session stays active for up to
   * 15 minutes on free tier, allowing users to continue shopping or checkout.
   *
   * @param request - Shopping automation request with items and preferences
   * @param secrets - Optional secrets for authentication (store_email, store_password)
   */
  async startShoppingAutomation(
    request: ShoppingAutomationRequest,
    secrets?: Record<string, string>
  ): Promise<{ taskId: string; sessionId: string; liveUrl: string; browserSessionId: string }> {
    const storeConfig = SUPPORTED_STORES[request.store];

    if (!storeConfig) {
      throw this.createError(
        "INVALID_STORE",
        `Store "${request.store}" is not supported. Supported stores: ${Object.keys(SUPPORTED_STORES).join(", ")}`,
        400
      );
    }

    // Step 1: Create a session FIRST with the store's start URL
    // This gives us the liveUrl immediately, which will be the access point
    // for users to continue shopping after automation completes
    console.log("[BrowserUse] Creating session for store:", storeConfig.name, {
      hasCredentials: request.hasStoredCredentials,
    });

    const session = await this.createSession({
      startUrl: storeConfig.startUrl,
    });

    console.log("[BrowserUse] Session created:", {
      sessionId: session.id,
      liveUrl: session.liveUrl,
      status: session.status,
    });

    const taskPrompt = this.buildShoppingPrompt(request, storeConfig);
    const structuredOutputSchema = this.buildShoppingOutputSchema();

    // Step 2: Create task attached to the existing session
    // By using sessionId, the task runs in our pre-created session
    // and the session stays alive after the task completes
    const taskResponse = await this.startTask({
      task: taskPrompt,
      llm: "browser-use-llm",
      startUrl: storeConfig.startUrl,
      thinking: true,
      maxSteps: 100, // Shopping requires more steps than recipe extraction
      structuredOutput: structuredOutputSchema,
      vision: "auto",
      flashMode: true,
      highlightElements: false,
      allowedDomains: storeConfig.domains,
      secrets, // Contains store_email and store_password if user has stored credentials
      sessionId: session.id, // Attach to pre-created session
    });

    console.log("[BrowserUse] Task started in session:", {
      taskId: taskResponse.id,
      sessionId: session.id,
      liveUrl: session.liveUrl,
      hasCredentials: request.hasStoredCredentials,
    });

    return {
      taskId: taskResponse.id,
      sessionId: session.id,
      liveUrl: session.liveUrl, // Direct access to live browser with cart state
      browserSessionId: session.id,
    };
  }

  /**
   * Parse and validate shopping automation result
   */
  public parseShoppingResult(
    result: unknown,
    store: SupportedStore
  ): ShoppingAutomationResult {
    try {
      const data = typeof result === "string" ? JSON.parse(result) : result;

      if (data.error) {
        throw this.createError("SHOPPING_FAILED", data.error, 422);
      }

      // Validate required fields
      if (!data.status || !Array.isArray(data.foundItems)) {
        throw this.createError(
          "INVALID_DATA",
          "Missing required fields in shopping result",
          422
        );
      }

      return {
        status: data.status || "failed",
        cartUrl: data.cartUrl,
        foundItems: data.foundItems || [],
        notFoundItems: data.notFoundItems || [],
        substitutions: data.substitutions || [],
        totalPrice: data.totalPrice ? Number(data.totalPrice) : undefined,
        estimatedTax: data.estimatedTax ? Number(data.estimatedTax) : undefined,
        itemCount: Number(data.itemCount) || 0,
        store,
        completedAt: new Date().toISOString(),
        errors: data.errors,
      };
    } catch (error) {
      if (error instanceof BrowserUseError) throw error;
      throw this.createError(
        "PARSE_ERROR",
        "Failed to parse shopping automation result",
        422,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Build structured output schema for shopping results
   */
  private buildShoppingOutputSchema(): string {
    return JSON.stringify({
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["success", "partial", "failed"],
        },
        cartUrl: { type: "string" },
        foundItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              requestedAmount: { type: "number" },
              requestedUnit: { type: "string" },
              status: {
                type: "string",
                enum: ["found", "not_found", "substituted", "partial"],
              },
              foundProduct: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  price: { type: "number" },
                  quantity: { type: "number" },
                  unit: { type: "string" },
                  imageUrl: { type: "string" },
                },
              },
            },
            required: ["name", "requestedAmount", "requestedUnit", "status"],
          },
        },
        notFoundItems: { type: "array", items: { type: "object" } },
        substitutions: { type: "array", items: { type: "object" } },
        totalPrice: { type: "number" },
        estimatedTax: { type: "number" },
        itemCount: { type: "number" },
        errors: { type: "array", items: { type: "string" } },
      },
      required: ["status", "foundItems", "notFoundItems", "itemCount"],
    });
  }

  /**
   * Build an intelligent prompt for shopping automation
   * Uses transformed items with clear quantities for better search results
   * Includes conditional login instructions when user has stored credentials
   */
  private buildShoppingPrompt(
    request: ShoppingAutomationRequest,
    storeConfig: StoreConfig
  ): string {
    // Transform items to shopping-friendly format with proper quantities
    const transformedItems = transformShoppingItems(
      request.items.map((item) => ({
        name: item.name,
        amount: item.amount,
        unit: item.unit,
        category: item.category,
        notes: item.notes,
      }))
    );

    // Format as simple list: "- ingredient: quantity"
    const itemsList = formatAsShoppingList(transformedItems);

    const preferences = request.preferences || {};

    // Build preference notes
    const preferenceNotes: string[] = [];
    if (preferences.preferOrganic) {
      preferenceNotes.push("Prefer organic (bio/eko) products when available");
    }
    if (preferences.preferStoreBrand) {
      preferenceNotes.push("Prefer store brand products for value");
    }
    if (preferences.maxPricePerItem) {
      preferenceNotes.push(`Skip items over ${preferences.maxPricePerItem} PLN`);
    }

    // Conditional authentication instructions
    const authSection = request.hasStoredCredentials
      ? `AUTHENTICATION (REQUIRED FIRST):
1. Look for "Zaloguj" (Login) or "Moje konto" (My Account) button in the header
2. Click to open the login form
3. Enter email: {{store_email}}
4. Enter password: {{store_password}}
5. Submit the login form and wait for it to complete
6. Verify login was successful (look for account name or "Wyloguj" button)
7. If login fails after 2 attempts, continue as guest

`
      : "";

    // Conditional login rule
    const loginRule = request.hasStoredCredentials
      ? "- You MUST log in first using the credentials provided above"
      : "- Do NOT log in - browse as guest";

    // Adjust step numbers based on whether auth is required
    const taskSteps = request.hasStoredCredentials
      ? `YOUR TASK:
1. Accept any cookie banners or popups first
2. Log in to your account using the credentials above
3. For each item in the shopping list:
   - Search for the item using the store's search (translate to Polish if needed)
   - Find the best matching product
   - If the exact quantity (e.g., 50g) is not available, add the smallest available package size (e.g., 500g pack)
   - Add 1 unit to cart
4. After all items, go to cart page (koszyk)
5. Get the cart URL and total price`
      : `YOUR TASK:
1. Accept any cookie banners or popups first
2. For each item in the shopping list:
   - Search for the item using the store's search (translate to Polish if needed)
   - Find the best matching product
   - If the exact quantity (e.g., 50g) is not available, add the smallest available package size (e.g., 500g pack)
   - Add 1 unit to cart
3. After all items, go to cart page (koszyk)
4. Get the cart URL and total price`;

    return `You are a shopping assistant for ${storeConfig.name} grocery store in Poland.

${authSection}SHOPPING LIST:
${itemsList}

${taskSteps}

${preferenceNotes.length > 0 ? `PREFERENCES:\n${preferenceNotes.map((p) => `- ${p}`).join("\n")}\n` : ""}
IMPORTANT RULES:
${loginRule}
- If an item is not found after 2 search attempts, skip it
- ${preferences.allowSubstitutions ? "If exact item unavailable, pick a similar alternative" : "Do not substitute items"}
- Do NOT proceed to checkout/payment

POLISH STORE TERMS:
- Szukaj = Search
- Dodaj do koszyka = Add to cart
- Koszyk = Cart
- Suma = Total
- Zaloguj = Login
- Wyloguj = Logout
- Moje konto = My Account

OUTPUT: Return JSON with status ("success"/"partial"/"failed"), cartUrl, foundItems, notFoundItems, totalPrice, itemCount.`;
  }

  // --------------------------------------------------------------------------
  // Recipe Extraction Methods
  // --------------------------------------------------------------------------

  /**
   * Build an intelligent prompt for recipe extraction
   */
  private buildRecipeExtractionPrompt(
    url: string,
    options?: RecipeExtractionRequest["options"]
  ): string {
    const basePrompt = `Navigate to ${url} Extract the complete recipe information as follows:

1. Wait for the page to fully load and for all dynamic content to be visible (wait at least 2 seconds after navigation, and after dismissing any pop-ups).
2. Automatically detect and close or accept any pop-ups, overlays, cookie banners, or registration walls.
3. For the following fields, extract directly from the DOM, structured data (such as JSON-LD <script> tags), and meta tags:
- title: Recipe title
- description: Brief description
- prepTime, cookTime, servings: extract as numbers, from visible fields, meta tags, or structured data
- difficulty: If not labeled, infer as 'easy' if preparation is simple and ingredients are few, else leave null
- imageUrl: Extract from the main recipe image, <meta property="og:image">, or JSON-LD; ensure it's a full URL
- ingredients: List each with name, amount, and unit. Parse amounts and units from structured data if available, else from the visible list
- instructions: Extract step-by-step instructions as an array, using either the visible steps, or from structured data
- tags: Extract from any labeled categories, cuisines, or tags on the page, or in structured data/meta tags; if not available, leave as an empty array
- calories, protein, carbs, fat: Extract from nutrition facts section, structured data, or meta tags. If not found, use null
4. If any field is not found, set its value to null (or an empty array for lists) in the JSON.
5. Output only the JSON object as specified below, with no extra text:
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
6. If the recipe is not found, return {"error": "No recipe found on this page"}
`;

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
