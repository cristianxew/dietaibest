/**
 * Browser Use API Client for Shopping Automation (API v2)
 *
 * Client for automating grocery shopping cart filling at supported Polish
 * stores using Browser Use Cloud API v2.
 *
 * (Recipe import was discontinued in favor of the in-app AI chat, which uses
 * Supadata for URLs and Gemma for images.)
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
  // Task Status & Lifecycle
  // --------------------------------------------------------------------------

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
