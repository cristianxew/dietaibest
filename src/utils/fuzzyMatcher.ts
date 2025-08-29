/**
 * Fuzzy Matching Algorithm for Ingredient Matching
 *
 * This module provides fuzzy string matching functionality to map user-entered
 * ingredients to standardized ingredients in the nutrition database.
 *
 * Features:
 * - Levenshtein distance calculation
 * - Ingredient name normalization
 * - Scoring system with confidence levels
 * - Caching for frequently matched ingredients
 * - Ingredient substitution suggestions
 */

import { Ingredient } from "@/generated/prisma";

// Cache for frequently matched ingredients
const matchCache = new Map<string, CachedMatch>();

interface CachedMatch {
  match: IngredientMatch;
  timestamp: number;
}

export interface IngredientMatch {
  ingredient: Ingredient;
  score: number; // 0-1, where 1 is perfect match
  confidence: "high" | "medium" | "low" | "none";
  matchType: "exact" | "normalized" | "fuzzy" | "partial" | "substitution";
  substitutionFor?: string; // Original ingredient if this is a substitution
}

export interface FuzzyMatchOptions {
  threshold?: number; // Minimum score to consider a match (default: 0.6)
  maxResults?: number; // Maximum number of results to return (default: 5)
  includeSubstitutions?: boolean; // Include ingredient substitutions (default: true)
  cacheResults?: boolean; // Cache results for performance (default: true)
  cacheTTL?: number; // Cache time-to-live in milliseconds (default: 1 hour)
}

const DEFAULT_OPTIONS: Required<FuzzyMatchOptions> = {
  threshold: 0.6,
  maxResults: 5,
  includeSubstitutions: true,
  cacheResults: true,
  cacheTTL: 60 * 60 * 1000, // 1 hour
};

// Common ingredient variations and their normalized forms
const INGREDIENT_NORMALIZATIONS: Record<string, string> = {
  // Plurals and variations
  apples: "apple",
  tomatoes: "tomato",
  potatoes: "potato",
  onions: "onion",
  peppers: "pepper",
  chillies: "chili",
  chilies: "chili",

  // Common abbreviations
  evoo: "extra virgin olive oil",
  oo: "olive oil",
  "ap flour": "all-purpose flour",
  "bread flour": "bread flour",

  // Common substitutions
  butter: "butter",
  margarine: "butter", // Note: This is a substitution
  oil: "vegetable oil",

  // Spelling variations
  yogurt: "yogurt",
  yoghurt: "yogurt",
  donut: "doughnut",
  catsup: "ketchup",
  mayo: "mayonnaise",
};

// Ingredient substitution mappings
const INGREDIENT_SUBSTITUTIONS: Record<string, string[]> = {
  butter: ["margarine", "ghee", "coconut oil", "vegetable oil"],
  milk: ["almond milk", "soy milk", "oat milk", "coconut milk"],
  egg: ["flax egg", "chia egg", "applesauce", "banana"],
  sugar: ["honey", "maple syrup", "agave nectar", "stevia"],
  flour: ["almond flour", "coconut flour", "rice flour", "oat flour"],
  "sour cream": ["greek yogurt", "cream cheese", "buttermilk"],
  "heavy cream": ["half and half", "evaporated milk", "coconut cream"],
};

/**
 * Calculate Levenshtein distance between two strings
 * This is the minimum number of single-character edits required to change one string into another
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create a 2D array for dynamic programming
  const dp: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize base cases
  for (let i = 0; i <= len1; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    dp[0][j] = j;
  }

  // Fill the dp table
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] =
          1 +
          Math.min(
            dp[i - 1][j], // deletion
            dp[i][j - 1], // insertion
            dp[i - 1][j - 1] // substitution
          );
      }
    }
  }

  return dp[len1][len2];
}

/**
 * Calculate similarity score between two strings (0-1)
 */
function calculateSimilarityScore(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);

  if (maxLength === 0) return 1; // Both strings are empty

  return 1 - distance / maxLength;
}

/**
 * Normalize ingredient name for better matching
 */
export function normalizeIngredientName(name: string): string {
  let normalized = name.toLowerCase().trim();

  // Remove common words that don't affect ingredient identity
  const stopWords = ["the", "a", "an", "of", "with", "or"];
  normalized = normalized
    .split(/\s+/)
    .filter((word) => !stopWords.includes(word))
    .join(" ");

  // Remove special characters but keep hyphens and apostrophes
  normalized = normalized.replace(/[^\w\s'-]/g, "");

  // Remove extra spaces
  normalized = normalized.replace(/\s+/g, " ").trim();

  // Apply known normalizations
  if (INGREDIENT_NORMALIZATIONS[normalized]) {
    normalized = INGREDIENT_NORMALIZATIONS[normalized];
  }

  // Handle common patterns
  // Remove trailing 's' for potential plurals (but not 'ss')
  if (normalized.endsWith("s") && !normalized.endsWith("ss")) {
    const singular = normalized.slice(0, -1);
    if (INGREDIENT_NORMALIZATIONS[singular]) {
      normalized = INGREDIENT_NORMALIZATIONS[singular];
    }
  }

  return normalized;
}

/**
 * Check if the input contains common misspellings or variations
 */
function checkCommonVariations(input: string, target: string): boolean {
  const inputLower = input.toLowerCase();
  const targetLower = target.toLowerCase();

  // Check for common misspellings
  const commonMisspellings: Record<string, string[]> = {
    broccoli: ["brocoli", "brocolli", "broccolli"],
    cauliflower: ["califlower", "cauliflour"],
    zucchini: ["zuchini", "zuccini", "zuchini"],
    parmesan: ["parmesean", "parmasean", "parmasan"],
    worcestershire: ["worchestershire", "worcester", "worchester"],
  };

  for (const [correct, misspellings] of Object.entries(commonMisspellings)) {
    if (targetLower === correct && misspellings.includes(inputLower)) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate match confidence based on score
 */
function getConfidenceLevel(score: number): "high" | "medium" | "low" | "none" {
  if (score >= 0.9) return "high";
  if (score >= 0.75) return "medium";
  if (score >= 0.6) return "low";
  return "none";
}

/**
 * Determine match type based on matching process
 */
function getMatchType(
  input: string,
  matched: string,
  score: number,
  isSubstitution: boolean = false
): IngredientMatch["matchType"] {
  if (isSubstitution) return "substitution";
  if (score === 1.0) return "exact";
  if (normalizeIngredientName(input) === normalizeIngredientName(matched))
    return "normalized";
  if (score >= 0.8) return "fuzzy";
  return "partial";
}

/**
 * Get ingredient substitutions
 */
function getSubstitutions(ingredientName: string): string[] {
  const normalized = normalizeIngredientName(ingredientName);

  // Direct substitutions
  if (INGREDIENT_SUBSTITUTIONS[normalized]) {
    return INGREDIENT_SUBSTITUTIONS[normalized];
  }

  // Check if this ingredient is mentioned in any substitution lists
  for (const [original, substitutes] of Object.entries(
    INGREDIENT_SUBSTITUTIONS
  )) {
    if (substitutes.includes(normalized)) {
      // This ingredient can substitute for the original
      return [original, ...substitutes.filter((s) => s !== normalized)];
    }
  }

  return [];
}

/**
 * Clear expired cache entries
 */
function clearExpiredCache(ttl: number): void {
  const now = Date.now();
  for (const [key, value] of matchCache.entries()) {
    if (now - value.timestamp > ttl) {
      matchCache.delete(key);
    }
  }
}

/**
 * Main fuzzy matching function
 */
export async function fuzzyMatchIngredient(
  input: string,
  ingredients: Ingredient[],
  options: FuzzyMatchOptions = {}
): Promise<IngredientMatch[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Check cache first
  if (opts.cacheResults) {
    clearExpiredCache(opts.cacheTTL);
    const cacheKey = `${input}:${opts.threshold}:${opts.includeSubstitutions}`;
    const cached = matchCache.get(cacheKey);
    if (cached) {
      return [cached.match];
    }
  }

  const normalizedInput = normalizeIngredientName(input);
  const matches: IngredientMatch[] = [];

  // First pass: Look for exact and normalized matches
  for (const ingredient of ingredients) {
    const normalizedIngredient = normalizeIngredientName(ingredient.name);

    // Exact match
    if (input.toLowerCase() === ingredient.name.toLowerCase()) {
      const match: IngredientMatch = {
        ingredient,
        score: 1.0,
        confidence: "high",
        matchType: "exact",
      };
      matches.push(match);
      continue;
    }

    // Normalized match
    if (normalizedInput === normalizedIngredient) {
      const match: IngredientMatch = {
        ingredient,
        score: 0.95,
        confidence: "high",
        matchType: "normalized",
      };
      matches.push(match);
      continue;
    }
  }

  // If we have high-confidence matches, return them
  if (matches.length > 0 && matches[0].confidence === "high") {
    const topMatch = matches[0];
    if (opts.cacheResults) {
      const cacheKey = `${input}:${opts.threshold}:${opts.includeSubstitutions}`;
      matchCache.set(cacheKey, { match: topMatch, timestamp: Date.now() });
    }
    return matches.slice(0, opts.maxResults);
  }

  // Second pass: Fuzzy matching
  for (const ingredient of ingredients) {
    const normalizedIngredient = normalizeIngredientName(ingredient.name);

    // Check for common variations
    if (checkCommonVariations(input, ingredient.name)) {
      const match: IngredientMatch = {
        ingredient,
        score: 0.9,
        confidence: "high",
        matchType: "fuzzy",
      };
      matches.push(match);
      continue;
    }

    // Calculate similarity score
    const score = calculateSimilarityScore(
      normalizedInput,
      normalizedIngredient
    );

    if (score >= opts.threshold) {
      const match: IngredientMatch = {
        ingredient,
        score,
        confidence: getConfidenceLevel(score),
        matchType: getMatchType(input, ingredient.name, score),
      };
      matches.push(match);
    }
  }

  // Third pass: Check substitutions if enabled and no good matches found
  if (
    opts.includeSubstitutions &&
    matches.filter((m) => m.confidence !== "none").length === 0
  ) {
    const substitutions = getSubstitutions(normalizedInput);

    for (const substitution of substitutions) {
      for (const ingredient of ingredients) {
        const normalizedIngredient = normalizeIngredientName(ingredient.name);

        if (normalizedIngredient === normalizeIngredientName(substitution)) {
          const match: IngredientMatch = {
            ingredient,
            score: 0.7, // Lower score for substitutions
            confidence: "medium",
            matchType: "substitution",
            substitutionFor: input,
          };
          matches.push(match);
        }
      }
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  // Cache the top result if applicable
  if (opts.cacheResults && matches.length > 0) {
    const cacheKey = `${input}:${opts.threshold}:${opts.includeSubstitutions}`;
    matchCache.set(cacheKey, { match: matches[0], timestamp: Date.now() });
  }

  return matches.slice(0, opts.maxResults);
}

/**
 * Get substitution suggestions for an ingredient
 */
export function getIngredientSubstitutions(ingredientName: string): string[] {
  return getSubstitutions(ingredientName);
}

/**
 * Clear the match cache
 */
export function clearMatchCache(): void {
  matchCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: matchCache.size,
    entries: Array.from(matchCache.keys()),
  };
}
