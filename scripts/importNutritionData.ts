import { PrismaClient } from "../src/generated/prisma";
import { z } from "zod";

const prisma = new PrismaClient();

// Environment validation
const envSchema = z.object({
  USDA_API_KEY: z.string().min(1, "USDA_API_KEY is required"),
});

const env = envSchema.parse(process.env);

// USDA API configuration
const USDA_API_BASE_URL = "https://api.nal.usda.gov/fdc/v1";
const RATE_LIMIT_DELAY = 100; // ms between requests to respect rate limits
const BATCH_SIZE = 50; // Process foods in batches

// Error handling utility
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// Logging utility
class ImportLogger {
  private logs: Array<{
    timestamp: Date;
    level: "info" | "warn" | "error";
    message: string;
    data?: unknown;
  }> = [];

  info(message: string, data?: unknown) {
    const log = {
      timestamp: new Date(),
      level: "info" as const,
      message,
      data,
    };
    this.logs.push(log);
    console.log(`[INFO] ${message}`, data ? JSON.stringify(data, null, 2) : "");
  }

  warn(message: string, data?: unknown) {
    const log = {
      timestamp: new Date(),
      level: "warn" as const,
      message,
      data,
    };
    this.logs.push(log);
    console.warn(
      `[WARN] ${message}`,
      data ? JSON.stringify(data, null, 2) : ""
    );
  }

  error(message: string, data?: unknown) {
    const log = {
      timestamp: new Date(),
      level: "error" as const,
      message,
      data,
    };
    this.logs.push(log);
    console.error(
      `[ERROR] ${message}`,
      data ? JSON.stringify(data, null, 2) : ""
    );
  }

  getLogs() {
    return this.logs;
  }

  saveToFile(filename: string) {
    // Use dynamic import to avoid linter issues
    const fs = eval('require("fs")');
    const path = eval('require("path")');

    const logDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFile = path.join(logDir, filename);
    fs.writeFileSync(logFile, JSON.stringify(this.logs, null, 2));
    this.info(`Logs saved to ${logFile}`);
  }
}

// USDA API Response Types
interface USDAFood {
  fdcId: number;
  description: string;
  foodClass?: string;
  foodNutrients: USDANutrient[];
  ingredients?: string;
  brandOwner?: string;
  dataType: string;
  publicationDate?: string; // Sometimes missing
  scientificName?: string;
  foodCategory?:
    | {
        id: number;
        code: string;
        description: string;
      }
    | string; // Sometimes it's just a string
}

interface USDANutrient {
  nutrient?: {
    id: number;
    number: string;
    name: string;
    rank: number;
    unitName: string;
  };
  amount?: number;
  dataPoints?: number;
  derivationCode?: string;
  derivationDescription?: string;
}

interface USDASearchResponse {
  foods: USDAFood[];
  totalHits: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

// Data validation schemas
const usdaFoodSchema = z.object({
  fdcId: z.number(),
  description: z.string(),
  foodClass: z.string().optional(),
  foodNutrients: z.array(
    z.object({
      nutrient: z
        .object({
          id: z.number(),
          number: z.string(),
          name: z.string(),
          rank: z.number(),
          unitName: z.string(),
        })
        .optional(),
      amount: z.number().optional(),
      dataPoints: z.number().optional(),
      derivationCode: z.string().optional(),
      derivationDescription: z.string().optional(),
    })
  ),
  ingredients: z.string().optional(),
  brandOwner: z.string().optional(),
  dataType: z.string(),
  publicationDate: z.string().optional(), // Sometimes missing
  scientificName: z.string().optional(),
  foodCategory: z
    .union([
      z.object({
        id: z.number(),
        code: z.string(),
        description: z.string(),
      }),
      z.string(), // Sometimes it's just a string
    ])
    .optional(),
});

// USDA API Client
class USDAApiClient {
  private apiKey: string;
  private baseUrl: string;
  private logger: ImportLogger;

  constructor(apiKey: string, logger: ImportLogger) {
    this.apiKey = apiKey;
    this.baseUrl = USDA_API_BASE_URL;
    this.logger = logger;
  }

  private async makeRequest<T>(
    endpoint: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.append("api_key", this.apiKey);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    try {
      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(
          `USDA API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));

      return data;
    } catch (error) {
      this.logger.error(`API request failed for ${endpoint}`, {
        error: getErrorMessage(error),
        params,
      });
      throw error;
    }
  }

  async searchFoods(
    query: string,
    pageSize: number = 50,
    pageNumber: number = 1
  ): Promise<USDASearchResponse> {
    return this.makeRequest<USDASearchResponse>("/foods/search", {
      query,
      pageSize,
      pageNumber,
      dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"], // Focus on reliable data types
    });
  }

  async getFoodDetails(fdcId: number): Promise<USDAFood> {
    return this.makeRequest<USDAFood>(`/food/${fdcId}`);
  }

  async getFoodsList(
    pageSize: number = 50,
    pageNumber: number = 1
  ): Promise<USDASearchResponse> {
    return this.makeRequest<USDASearchResponse>("/foods/list", {
      pageSize,
      pageNumber,
      dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"],
    });
  }
}

// Data transformation utilities
class DataTransformer {
  private logger: ImportLogger;

  constructor(logger: ImportLogger) {
    this.logger = logger;
  }

  /**
   * Transforms USDA food data to match our database schema
   */
  transformFood(usdaFood: USDAFood): {
    ingredient: {
      name: string;
      description?: string;
      foodGroup?: string;
      source: string;
      commonName?: string;
      scientificName?: string;
      isCustom: boolean;
    };
    nutrients: Array<{
      nutrientName: string;
      value: number;
      unit: string;
      source: string;
      confidence: number;
      isEstimated: boolean;
    }>;
  } {
    // Extract food group from category or description
    let foodGroup: string | undefined;
    if (usdaFood.foodCategory) {
      if (typeof usdaFood.foodCategory === "string") {
        foodGroup = this.mapFoodCategory(usdaFood.foodCategory);
      } else if (usdaFood.foodCategory.description) {
        foodGroup = this.mapFoodCategory(usdaFood.foodCategory.description);
      }
    }

    // Clean and normalize ingredient name
    const name = this.normalizeIngredientName(usdaFood.description);

    // Transform nutrients - filter out invalid ones
    const nutrients = usdaFood.foodNutrients
      .filter(
        (nutrient) =>
          nutrient.nutrient &&
          nutrient.amount !== undefined &&
          nutrient.amount !== null &&
          nutrient.nutrient.name &&
          nutrient.nutrient.unitName
      )
      .map((nutrient) => ({
        nutrientName: this.normalizeNutrientName(nutrient.nutrient!.name),
        value: nutrient.amount!,
        unit: this.normalizeUnit(nutrient.nutrient!.unitName),
        source: `USDA-${usdaFood.dataType}`,
        confidence: this.calculateConfidence(nutrient),
        isEstimated: this.isEstimatedValue(nutrient),
      }));

    return {
      ingredient: {
        name,
        description:
          usdaFood.description.length > 255
            ? usdaFood.description.substring(0, 255)
            : usdaFood.description,
        foodGroup,
        source: `USDA-${usdaFood.dataType}`,
        commonName:
          name !== usdaFood.description ? usdaFood.description : undefined,
        scientificName: usdaFood.scientificName,
        isCustom: false,
      },
      nutrients,
    };
  }

  private mapFoodCategory(category: string): string {
    const categoryMap: Record<string, string> = {
      "Dairy and Egg Products": "Dairy",
      "Spices and Herbs": "Spices",
      "Baby Foods": "Baby Food",
      "Fats and Oils": "Fats",
      "Poultry Products": "Proteins",
      "Soups, Sauces, and Gravies": "Sauces",
      "Sausages and Luncheon Meats": "Proteins",
      "Breakfast Cereals": "Grains",
      "Fruits and Fruit Juices": "Fruits",
      "Pork Products": "Proteins",
      "Vegetables and Vegetable Products": "Vegetables",
      "Nut and Seed Products": "Nuts & Seeds",
      "Beef Products": "Proteins",
      Beverages: "Beverages",
      "Finfish and Shellfish Products": "Proteins",
      "Legumes and Legume Products": "Legumes",
      "Lamb, Veal, and Game Products": "Proteins",
      "Baked Products": "Baked Goods",
      Sweets: "Sweets",
      "Cereal Grains and Pasta": "Grains",
      "Fast Foods": "Fast Food",
      "Meals, Entrees, and Side Dishes": "Prepared Foods",
      Snacks: "Snacks",
    };

    return categoryMap[category] || "Other";
  }

  private normalizeIngredientName(name: string): string {
    // Remove USDA-specific prefixes/suffixes and standardize
    return name
      .replace(/^.*?,\s*/, "") // Remove food code prefixes
      .replace(/\s*\(.*?\)$/, "") // Remove parenthetical info at end
      .replace(/\s+/g, " ") // Normalize spaces
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase()); // Title case
  }

  private normalizeNutrientName(name: string): string {
    const nutrientMap: Record<string, string> = {
      Energy: "Energy",
      Protein: "Protein",
      "Total lipid (fat)": "Total Fat",
      "Carbohydrate, by difference": "Carbohydrates",
      "Fiber, total dietary": "Dietary Fiber",
      "Sugars, total including NLEA": "Sugars",
      "Calcium, Ca": "Calcium",
      "Iron, Fe": "Iron",
      "Magnesium, Mg": "Magnesium",
      "Phosphorus, P": "Phosphorus",
      "Potassium, K": "Potassium",
      "Sodium, Na": "Sodium",
      "Zinc, Zn": "Zinc",
      "Copper, Cu": "Copper",
      "Manganese, Mn": "Manganese",
      "Selenium, Se": "Selenium",
      "Vitamin C, total ascorbic acid": "Vitamin C",
      Thiamin: "Thiamin (B1)",
      Riboflavin: "Riboflavin (B2)",
      Niacin: "Niacin (B3)",
      "Pantothenic acid": "Pantothenic Acid",
      "Vitamin B-6": "Vitamin B6",
      "Folate, total": "Folate",
      "Vitamin B-12": "Vitamin B12",
      "Vitamin A, RAE": "Vitamin A",
      "Vitamin E (alpha-tocopherol)": "Vitamin E",
      "Vitamin D (D2 + D3)": "Vitamin D",
      "Vitamin K (phylloquinone)": "Vitamin K",
    };

    return nutrientMap[name] || name;
  }

  private normalizeUnit(unit: string): string {
    const unitMap: Record<string, string> = {
      KCAL: "kcal",
      G: "g",
      MG: "mg",
      UG: "mcg",
      IU: "IU",
    };

    return unitMap[unit.toUpperCase()] || unit.toLowerCase();
  }

  private calculateConfidence(nutrient: USDANutrient): number {
    // Calculate confidence based on data points and derivation
    let confidence = 0.8; // Base confidence

    if (nutrient.dataPoints && nutrient.dataPoints > 1) {
      confidence = Math.min(0.95, confidence + nutrient.dataPoints * 0.02);
    }

    if (nutrient.derivationCode) {
      // Higher confidence for analytical data
      if (nutrient.derivationCode.includes("A")) confidence += 0.1;
      if (nutrient.derivationCode.includes("C")) confidence -= 0.1;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private isEstimatedValue(nutrient: USDANutrient): boolean {
    return (
      nutrient.derivationCode?.includes("C") ||
      nutrient.derivationCode?.includes("NR") ||
      false
    );
  }
}

// Deduplication manager
class DeduplicationManager {
  private logger: ImportLogger;

  constructor(logger: ImportLogger) {
    this.logger = logger;
  }

  /**
   * Find potential duplicates in database
   */
  async findDuplicates(
    ingredientName: string,
    threshold: number = 0.8
  ): Promise<
    Array<{
      id: string;
      name: string;
      similarity: number;
    }>
  > {
    const existingIngredients = await prisma.ingredient.findMany({
      where: {
        OR: [
          { name: { contains: ingredientName, mode: "insensitive" } },
          { commonName: { contains: ingredientName, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, commonName: true },
    });

    const duplicates = existingIngredients
      .map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name,
        similarity: this.calculateSimilarity(ingredientName, ingredient.name),
      }))
      .filter((item) => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity);

    return duplicates;
  }

  /**
   * Simple string similarity calculation using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}

// Database operations manager
class DatabaseManager {
  private logger: ImportLogger;
  private deduplicationManager: DeduplicationManager;

  constructor(logger: ImportLogger) {
    this.logger = logger;
    this.deduplicationManager = new DeduplicationManager(logger);
  }

  /**
   * Import ingredient with nutrients, handling duplicates
   */
  async importIngredient(transformedData: {
    ingredient: {
      name: string;
      description?: string;
      foodGroup?: string;
      source: string;
      commonName?: string;
      scientificName?: string;
      isCustom: boolean;
    };
    nutrients: Array<{
      nutrientName: string;
      value: number;
      unit: string;
      source: string;
      confidence: number;
      isEstimated: boolean;
    }>;
  }): Promise<string | null> {
    try {
      // Check for duplicates
      const duplicates = await this.deduplicationManager.findDuplicates(
        transformedData.ingredient.name,
        0.9
      );

      let ingredientId: string;

      if (duplicates.length > 0) {
        // Update existing ingredient
        ingredientId = duplicates[0].id;
        this.logger.info(
          `Updating existing ingredient: ${transformedData.ingredient.name}`,
          {
            duplicateId: ingredientId,
            similarity: duplicates[0].similarity,
          }
        );

        await prisma.ingredient.update({
          where: { id: ingredientId },
          data: {
            ...transformedData.ingredient,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new ingredient
        const created = await prisma.ingredient.create({
          data: transformedData.ingredient,
        });
        ingredientId = created.id;
        this.logger.info(
          `Created new ingredient: ${transformedData.ingredient.name}`,
          {
            ingredientId,
          }
        );
      }

      // Import nutrients
      await this.importNutrients(ingredientId, transformedData.nutrients);

      return ingredientId;
    } catch (error) {
      this.logger.error(
        `Failed to import ingredient: ${transformedData.ingredient.name}`,
        {
          error: getErrorMessage(error),
        }
      );
      return null;
    }
  }

  /**
   * Import nutrients for an ingredient
   */
  private async importNutrients(
    ingredientId: string,
    nutrients: Array<{
      nutrientName: string;
      value: number;
      unit: string;
      source: string;
      confidence: number;
      isEstimated: boolean;
    }>
  ): Promise<void> {
    for (const nutrientData of nutrients) {
      try {
        // Find or create nutrient
        let nutrient = await prisma.nutrient.findUnique({
          where: { name: nutrientData.nutrientName },
        });

        if (!nutrient) {
          // Create nutrient with basic info
          nutrient = await prisma.nutrient.create({
            data: {
              name: nutrientData.nutrientName,
              unit: nutrientData.unit,
              nutrientCategory: this.categorizeNutrient(
                nutrientData.nutrientName
              ),
              subcategory: this.subcategorizeNutrient(
                nutrientData.nutrientName
              ),
            },
          });
        }

        // Create or update ingredient-nutrient relationship
        await prisma.ingredientNutrient.upsert({
          where: {
            ingredientId_nutrientId: {
              ingredientId,
              nutrientId: nutrient.id,
            },
          },
          create: {
            ingredientId,
            nutrientId: nutrient.id,
            value: nutrientData.value,
            source: nutrientData.source,
            confidence: nutrientData.confidence,
            isEstimated: nutrientData.isEstimated,
          },
          update: {
            value: nutrientData.value,
            source: nutrientData.source,
            confidence: nutrientData.confidence,
            isEstimated: nutrientData.isEstimated,
            updatedAt: new Date(),
          },
        });
      } catch (error) {
        this.logger.error(
          `Failed to import nutrient: ${nutrientData.nutrientName}`,
          {
            error: getErrorMessage(error),
            ingredientId,
          }
        );
      }
    }
  }

  private categorizeNutrient(name: string): string {
    const macroNutrients = [
      "Energy",
      "Protein",
      "Total Fat",
      "Carbohydrates",
      "Dietary Fiber",
      "Sugars",
    ];
    return macroNutrients.some((macro) => name.includes(macro))
      ? "macro"
      : "micro";
  }

  private subcategorizeNutrient(name: string): string {
    if (name.includes("Vitamin")) return "vitamin";
    if (
      [
        "Calcium",
        "Iron",
        "Magnesium",
        "Phosphorus",
        "Potassium",
        "Sodium",
        "Zinc",
      ].some((mineral) => name.includes(mineral))
    ) {
      return "mineral";
    }
    if (name.includes("Fat")) return "fat";
    if (
      name.includes("Carbohydrate") ||
      name.includes("Fiber") ||
      name.includes("Sugar")
    )
      return "carbohydrate";
    if (name.includes("Protein")) return "protein";
    if (name.includes("Energy")) return "energy";
    return "other";
  }
}

// Main import manager
class USDAImportManager {
  private apiClient: USDAApiClient;
  private transformer: DataTransformer;
  private databaseManager: DatabaseManager;
  private logger: ImportLogger;

  constructor() {
    this.logger = new ImportLogger();
    this.apiClient = new USDAApiClient(env.USDA_API_KEY, this.logger);
    this.transformer = new DataTransformer(this.logger);
    this.databaseManager = new DatabaseManager(this.logger);
  }

  /**
   * Import foods by search query
   */
  async importBySearch(
    query: string,
    maxResults: number = 100
  ): Promise<{
    imported: number;
    failed: number;
    duplicates: number;
  }> {
    this.logger.info(`Starting import by search: ${query}`, { maxResults });

    const stats = { imported: 0, failed: 0, duplicates: 0 };
    let currentPage = 1;
    let processedCount = 0;

    while (processedCount < maxResults) {
      try {
        const response = await this.apiClient.searchFoods(
          query,
          BATCH_SIZE,
          currentPage
        );

        if (!response.foods || response.foods.length === 0) {
          break;
        }

        const remainingToProcess = Math.min(
          response.foods.length,
          maxResults - processedCount
        );
        const foodsToProcess = response.foods.slice(0, remainingToProcess);

        for (const food of foodsToProcess) {
          try {
            // Validate food data
            const validatedFood = usdaFoodSchema.parse(food);

            // Transform data
            const transformedData =
              this.transformer.transformFood(validatedFood);

            // Import to database
            const result = await this.databaseManager.importIngredient(
              transformedData
            );

            if (result) {
              stats.imported++;
            } else {
              stats.failed++;
            }
          } catch (error) {
            this.logger.error(`Failed to process food: ${food.description}`, {
              error: getErrorMessage(error),
              fdcId: food.fdcId,
            });
            stats.failed++;
          }
        }

        processedCount += foodsToProcess.length;
        currentPage++;

        if (response.foods.length < BATCH_SIZE) {
          break; // No more pages
        }
      } catch (error) {
        this.logger.error(
          `Failed to fetch search results for page ${currentPage}`,
          {
            error: getErrorMessage(error),
            query,
          }
        );
        break;
      }
    }

    this.logger.info(`Import completed for query: ${query}`, stats);
    return stats;
  }

  /**
   * Import specific food by FDC ID
   */
  async importByFdcId(fdcId: number): Promise<boolean> {
    try {
      this.logger.info(`Importing food by FDC ID: ${fdcId}`);

      const food = await this.apiClient.getFoodDetails(fdcId);
      const validatedFood = usdaFoodSchema.parse(food);
      const transformedData = this.transformer.transformFood(validatedFood);

      const result = await this.databaseManager.importIngredient(
        transformedData
      );

      if (result) {
        this.logger.info(`Successfully imported food: ${food.description}`);
        return true;
      } else {
        this.logger.error(`Failed to import food: ${food.description}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Import failed for FDC ID: ${fdcId}`, {
        error: getErrorMessage(error),
      });
      return false;
    }
  }

  /**
   * Incremental update - import recently updated foods
   */
  async incrementalUpdate(since?: Date): Promise<{
    imported: number;
    failed: number;
    duplicates: number;
  }> {
    this.logger.info("Starting incremental update", { since });

    // For now, implement a simple version that imports foundation foods
    // In a production system, this would track last update timestamps
    const stats = { imported: 0, failed: 0, duplicates: 0 };

    try {
      let currentPage = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.apiClient.getFoodsList(
          BATCH_SIZE,
          currentPage
        );

        if (!response.foods || response.foods.length === 0) {
          hasMore = false;
          break;
        }

        for (const food of response.foods) {
          try {
            // Skip if we've already processed this food recently
            if (since && food.publicationDate) {
              const foodDate = new Date(food.publicationDate);
              if (foodDate < since) {
                continue;
              }
            }

            const validatedFood = usdaFoodSchema.parse(food);
            const transformedData =
              this.transformer.transformFood(validatedFood);

            const result = await this.databaseManager.importIngredient(
              transformedData
            );

            if (result) {
              stats.imported++;
            } else {
              stats.failed++;
            }
          } catch (error) {
            this.logger.error(`Failed to process food in incremental update`, {
              error: getErrorMessage(error),
              fdcId: food.fdcId,
            });
            stats.failed++;
          }
        }

        currentPage++;

        if (response.foods.length < BATCH_SIZE) {
          hasMore = false;
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error("Incremental update failed", {
          error: error.message,
        });
      } else {
        this.logger.error("Incremental update failed with an unknown error");
      }
    }

    this.logger.info("Incremental update completed", stats);
    return stats;
  }

  /**
   * Get import statistics
   */
  async getImportStats(): Promise<{
    totalIngredients: number;
    usdaIngredients: number;
    totalNutrients: number;
    lastImportDate?: Date;
  }> {
    const [totalIngredients, usdaIngredients, totalNutrients] =
      await Promise.all([
        prisma.ingredient.count(),
        prisma.ingredient.count({ where: { source: { startsWith: "USDA" } } }),
        prisma.nutrient.count(),
      ]);

    const lastImport = await prisma.ingredient.findFirst({
      where: { source: { startsWith: "USDA" } },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });

    return {
      totalIngredients,
      usdaIngredients,
      totalNutrients,
      lastImportDate: lastImport?.updatedAt,
    };
  }

  /**
   * Save logs to file
   */
  saveLogs(filename?: string): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logFilename = filename || `usda-import-${timestamp}.json`;
    this.logger.saveToFile(logFilename);
  }

  /**
   * Get current logs
   */
  getLogs() {
    return this.logger.getLogs();
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const importManager = new USDAImportManager();

  try {
    switch (command) {
      case "search":
        {
          const query = args[1];
          const maxResults = parseInt(args[2]) || 100;

          if (!query) {
            console.error(
              "Usage: bun run scripts/importNutritionData.ts search <query> [maxResults]"
            );
            process.exit(1);
          }

          const stats = await importManager.importBySearch(query, maxResults);
          console.log("\nImport Statistics:", stats);
        }
        break;

      case "fdcid":
        {
          const fdcId = parseInt(args[1]);

          if (!fdcId) {
            console.error(
              "Usage: bun run scripts/importNutritionData.ts fdcid <fdcId>"
            );
            process.exit(1);
          }

          const success = await importManager.importByFdcId(fdcId);
          console.log(success ? "Import successful" : "Import failed");
        }
        break;

      case "incremental":
        {
          const sinceDate = args[1] ? new Date(args[1]) : undefined;
          const stats = await importManager.incrementalUpdate(sinceDate);
          console.log("\nIncremental Update Statistics:", stats);
        }
        break;

      case "stats":
        {
          const stats = await importManager.getImportStats();
          console.log("\nDatabase Statistics:", stats);
        }
        break;

      default:
        console.log(`
USDA Nutrition Data Import Tool

Usage:
  bun run scripts/importNutritionData.ts search <query> [maxResults]  - Import foods by search query
  bun run scripts/importNutritionData.ts fdcid <fdcId>                - Import specific food by FDC ID
  bun run scripts/importNutritionData.ts incremental [sinceDate]      - Incremental update since date
  bun run scripts/importNutritionData.ts stats                        - Show import statistics

Examples:
  bun run scripts/importNutritionData.ts search "apple" 50
  bun run scripts/importNutritionData.ts fdcid 169205
  bun run scripts/importNutritionData.ts incremental "2024-01-01"
  bun run scripts/importNutritionData.ts stats

Environment Variables:
  USDA_API_KEY - Required USDA FoodData Central API key
        `);
    }
  } catch (error) {
    console.error("Import failed:", getErrorMessage(error));
    process.exit(1);
  } finally {
    importManager.saveLogs();
    await prisma.$disconnect();
  }
}

// Export classes for use in other modules
export {
  USDAImportManager,
  USDAApiClient,
  DataTransformer,
  DeduplicationManager,
  DatabaseManager,
  ImportLogger,
};

// Run CLI if executed directly
if (require.main === module) {
  main().catch(console.error);
}
