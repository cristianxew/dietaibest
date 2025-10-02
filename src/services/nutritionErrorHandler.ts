/**
 * Nutrition Error Handler
 *
 * Provides comprehensive error handling for the nutrition analysis system,
 * including fallback mechanisms, user-friendly messages, and suggestions.
 */

import { fuzzyMatchIngredient } from "../utils/fuzzyMatcher";
// import { getNutritionDataProvider } from "./nutritionDataProvider";

export interface NutritionError {
  type:
    | "parsing"
    | "matching"
    | "conversion"
    | "calculation"
    | "api"
    | "unknown";
  ingredient?: string;
  message: string;
  userMessage: string;
  suggestions?: string[];
  confidence?: number;
  fallbackValue?: any;
}

export interface ErrorHandlingOptions {
  suggestAlternatives: boolean;
  maxSuggestions: number;
  includeConfidence: boolean;
  verboseLogging: boolean;
}

const DEFAULT_OPTIONS: ErrorHandlingOptions = {
  suggestAlternatives: true,
  maxSuggestions: 3,
  includeConfidence: true,
  verboseLogging: process.env.NODE_ENV === "development",
};

/**
 * Handle ingredient parsing errors
 */
export function handleParsingError(
  ingredientText: string,
  error?: Error,
  options: Partial<ErrorHandlingOptions> = {}
): NutritionError {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (opts.verboseLogging && error) {
    console.error(`Parsing error for "${ingredientText}":`, error);
  }

  // Try to extract at least the ingredient name
  const words = ingredientText.trim().split(/\s+/);
  const potentialName = words
    .filter(
      (w) =>
        !/^\d/.test(w) && // Not starting with number
        !/^(cup|tbsp|tsp|oz|g|lb|ml|l)s?$/i.test(w) // Not a unit
    )
    .join(" ");

  return {
    type: "parsing",
    ingredient: ingredientText,
    message: `Failed to parse ingredient: ${ingredientText}`,
    userMessage: `Could not understand "${ingredientText}". Try format like "2 cups flour" or "100g chicken breast".`,
    suggestions: potentialName ? [`1 serving ${potentialName}`] : undefined,
    confidence: 0.3,
    fallbackValue: {
      name: potentialName || ingredientText,
      amount: 1,
      unit: "serving",
    },
  };
}

/**
 * Handle ingredient matching errors with fuzzy search suggestions
 */
export async function handleMatchingError(
  ingredientName: string,
  options: Partial<ErrorHandlingOptions> = {}
): Promise<NutritionError> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (opts.verboseLogging) {
    console.warn(`No match found for ingredient: ${ingredientName}`);
  }

  let suggestions: string[] = [];

  if (opts.suggestAlternatives) {
    try {
      // Use fuzzy matching to find similar ingredients
      const matches = await fuzzyMatchIngredient(ingredientName, {
        maxResults: opts.maxSuggestions + 2, // Get extra in case some are duplicates
        threshold: 0.4,
      });

      // Extract ingredient names from matches
      if (Array.isArray(matches)) {
        suggestions = matches
          .slice(0, opts.maxSuggestions)
          .map((m) => m.ingredient.name);
      } else if (matches) {
        // Single match returned
        suggestions = [matches.ingredient.name];
      }
    } catch (error) {
      if (opts.verboseLogging) {
        console.error("Error getting suggestions:", error);
      }
    }
  }

  const hasSuggestions = suggestions.length > 0;

  return {
    type: "matching",
    ingredient: ingredientName,
    message: `No nutrition data found for: ${ingredientName}`,
    userMessage: hasSuggestions
      ? `"${ingredientName}" not found in database. Did you mean one of these?`
      : `"${ingredientName}" not found. Try using a more common ingredient name.`,
    suggestions,
    confidence: 0,
    fallbackValue: null,
  };
}

/**
 * Handle unit conversion errors
 */
export function handleConversionError(
  amount: number,
  unit: string,
  ingredientName: string,
  error?: Error,
  options: Partial<ErrorHandlingOptions> = {}
): NutritionError {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (opts.verboseLogging && error) {
    console.error(
      `Conversion error for ${amount} ${unit} of ${ingredientName}:`,
      error
    );
  }

  // Common unit suggestions based on the unrecognized unit
  const unitSuggestions: Record<string, string[]> = {
    handful: ["1/4 cup", "30g"],
    pinch: ["1/8 teaspoon", "0.5g"],
    dash: ["1/8 teaspoon", "1ml"],
    bunch: ["1 cup", "100g"],
    package: ["Check package weight", "200g (estimate)"],
    can: ["15 oz", "425g"],
    jar: ["16 oz", "450g"],
    bottle: ["12 fl oz", "355ml"],
  };

  const unitLower = unit.toLowerCase();
  const suggestions = unitSuggestions[unitLower];

  return {
    type: "conversion",
    ingredient: ingredientName,
    message: `Cannot convert ${amount} ${unit} to standard units`,
    userMessage: suggestions
      ? `"${unit}" is not a standard unit. Try: ${suggestions.join(" or ")}`
      : `Cannot convert "${unit}" to weight. Try using cups, tablespoons, grams, or ounces.`,
    suggestions: suggestions?.map((s) => `${amount} ${s} ${ingredientName}`),
    confidence: 0.5,
    fallbackValue: {
      amount,
      unit,
      warning: "Unit conversion failed, using estimate",
    },
  };
}

/**
 * Handle nutrition calculation errors
 */
export function handleCalculationError(
  ingredient: string,
  error: Error,
  options: Partial<ErrorHandlingOptions> = {}
): NutritionError {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (opts.verboseLogging) {
    console.error(`Calculation error for ${ingredient}:`, error);
  }

  return {
    type: "calculation",
    ingredient,
    message: error.message,
    userMessage: `Could not calculate nutrition for "${ingredient}". The data may be incomplete.`,
    confidence: 0,
    fallbackValue: null,
  };
}

/**
 * Handle API errors with retry suggestions
 */
export function handleAPIError(
  error: Error,
  endpoint?: string,
  options: Partial<ErrorHandlingOptions> = {}
): NutritionError {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (opts.verboseLogging) {
    console.error(`API error${endpoint ? ` for ${endpoint}` : ""}:`, error);
  }

  // Check for specific error types
  let userMessage = "Unable to fetch nutrition data. Please try again.";

  if (error.message.includes("timeout")) {
    userMessage = "Request timed out. Please try again with fewer ingredients.";
  } else if (error.message.includes("rate limit")) {
    userMessage = "Too many requests. Please wait a moment and try again.";
  } else if (error.message.includes("network")) {
    userMessage = "Network error. Please check your connection and try again.";
  }

  return {
    type: "api",
    message: error.message,
    userMessage,
    confidence: 0,
    suggestions: ["Try again", "Use fewer ingredients", "Check connection"],
  };
}

/**
 * Create user-friendly error messages with suggestions
 */
export function formatErrorForUser(
  error: NutritionError,
  includeDetails: boolean = false
): string {
  let message = error.userMessage;

  if (error.suggestions && error.suggestions.length > 0) {
    message += "\n\nSuggestions:\n";
    error.suggestions.forEach((suggestion, i) => {
      message += `${i + 1}. ${suggestion}\n`;
    });
  }

  if (includeDetails && error.confidence !== undefined) {
    message += `\nConfidence: ${Math.round(error.confidence * 100)}%`;
  }

  return message;
}

/**
 * Aggregate multiple errors into a summary
 */
export function aggregateErrors(errors: NutritionError[]): {
  summary: string;
  byType: Record<string, NutritionError[]>;
  hasRecoverableErrors: boolean;
  hasCriticalErrors: boolean;
} {
  const byType: Record<string, NutritionError[]> = {};

  errors.forEach((error) => {
    if (!byType[error.type]) {
      byType[error.type] = [];
    }
    byType[error.type].push(error);
  });

  const hasRecoverableErrors = errors.some((e) => e.fallbackValue !== null);
  const hasCriticalErrors = errors.some(
    (e) => e.type === "api" || e.confidence === 0
  );

  let summary = "";

  if (errors.length === 0) {
    summary = "No errors";
  } else if (errors.length === 1) {
    summary = errors[0].userMessage;
  } else {
    const counts = Object.entries(byType).map(
      ([type, errs]) =>
        `${errs.length} ${type} error${errs.length > 1 ? "s" : ""}`
    );
    summary = `Found ${errors.length} issues: ${counts.join(", ")}`;
  }

  return {
    summary,
    byType,
    hasRecoverableErrors,
    hasCriticalErrors,
  };
}

/**
 * Error recovery strategies
 */
export interface RecoveryStrategy {
  type: "use_fallback" | "skip" | "retry" | "suggest_alternative";
  action: () => Promise<any>;
  confidence: number;
}

/**
 * Determine recovery strategy for an error
 */
export function getRecoveryStrategy(
  error: NutritionError,
  context?: any
): RecoveryStrategy {
  // Use fallback if available and confidence is reasonable
  if (error.fallbackValue && error.confidence && error.confidence >= 0.3) {
    return {
      type: "use_fallback",
      action: async () => error.fallbackValue,
      confidence: error.confidence,
    };
  }

  // Skip if confidence is too low
  if (error.confidence === 0) {
    return {
      type: "skip",
      action: async () => null,
      confidence: 0,
    };
  }

  // Suggest alternatives if available
  if (error.suggestions && error.suggestions.length > 0) {
    return {
      type: "suggest_alternative",
      action: async () => ({
        suggestions: error.suggestions,
        originalError: error,
      }),
      confidence: 0.5,
    };
  }

  // Default to skip
  return {
    type: "skip",
    action: async () => null,
    confidence: 0,
  };
}

/**
 * Log errors for monitoring and improvement
 */
export function logErrorForMonitoring(
  error: NutritionError,
  userId?: string,
  sessionId?: string
): void {
  // In production, this would send to a monitoring service
  // For now, just log to console in development
  if (process.env.NODE_ENV === "development") {
    console.log("Nutrition Error Log:", {
      timestamp: new Date().toISOString(),
      type: error.type,
      ingredient: error.ingredient,
      message: error.message,
      confidence: error.confidence,
      userId,
      sessionId,
    });
  }
}

/**
 * Create feedback mechanism for users to report issues
 */
export interface UserFeedback {
  errorId: string;
  ingredient: string;
  userCorrection?: string;
  userComment?: string;
  helpfulSuggestion?: string;
  timestamp: Date;
}

export async function collectUserFeedback(
  error: NutritionError,
  feedback: Partial<UserFeedback>
): Promise<void> {
  const fullFeedback: UserFeedback = {
    errorId: generateErrorId(error),
    ingredient: error.ingredient || "unknown",
    timestamp: new Date(),
    ...feedback,
  };

  // In production, this would save to database
  // For now, just log it
  console.log("User Feedback Collected:", fullFeedback);

  // Could trigger retraining or manual review based on feedback
  if (fullFeedback.userCorrection) {
    await suggestIngredientMapping(
      error.ingredient || "",
      fullFeedback.userCorrection
    );
  }
}

/**
 * Generate unique error ID for tracking
 */
function generateErrorId(error: NutritionError): string {
  const timestamp = Date.now();
  const type = error.type;
  const ingredient = error.ingredient || "unknown";
  return `${type}-${ingredient.replace(/\s+/g, "-")}-${timestamp}`;
}

/**
 * Suggest ingredient mapping for future improvements
 */
async function suggestIngredientMapping(
  original: string,
  corrected: string
): Promise<void> {
  // In production, this would save to a mappings table
  // that could be reviewed and added to the database
  console.log("Suggested Mapping:", {
    original,
    corrected,
    timestamp: new Date().toISOString(),
    status: "pending_review",
  });
}

/**
 * Error boundary for nutrition calculations
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: {
    ingredient?: string;
    operation?: string;
  },
  options: Partial<ErrorHandlingOptions> = {}
): Promise<{ result?: T; error?: NutritionError }> {
  try {
    const result = await operation();
    return { result };
  } catch (error) {
    const nutritionError =
      error instanceof Error
        ? handleCalculationError(
            context.ingredient || "unknown",
            error,
            options
          )
        : {
            type: "unknown" as const,
            message: "Unknown error occurred",
            userMessage: "An unexpected error occurred",
            confidence: 0,
          };

    logErrorForMonitoring(nutritionError, undefined, context.operation);

    return { error: nutritionError };
  }
}
