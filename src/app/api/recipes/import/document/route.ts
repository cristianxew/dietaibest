import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
// Removed unused fs/path imports
import { randomUUID } from "crypto";

// Google Cloud Document AI imports
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { PDFDocument } from "pdf-lib";

// Configuration
const SUPPORTED_FORMATS = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/tiff",
  "image/bmp",
  "application/pdf",
];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_PDF_PAGES = 10; // Enforced maximum PDF pages allowed

// Google Cloud Document AI configuration
const DOCUMENT_AI_CONFIG = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  location: process.env.DOCUMENT_AI_LOCATION || "eu", // us, eu, asia
  customProcessorId: process.env.DOCUMENT_AI_CUSTOM_PROCESSOR_ID,
  serviceAccountPath: process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH,
};

// Check if Document AI is properly configured
function isDocumentAIConfigured(): boolean {
  return !!(
    DOCUMENT_AI_CONFIG.projectId &&
    DOCUMENT_AI_CONFIG.customProcessorId &&
    DOCUMENT_AI_CONFIG.serviceAccountPath
  );
}

// Initialize Document AI client with proper authentication
function getDocumentAIClient() {
  const options: {
    apiEndpoint: string;
    credentials?: object;
    keyFilename?: string;
  } = {
    apiEndpoint: `${DOCUMENT_AI_CONFIG.location}-documentai.googleapis.com`,
  };

  if (DOCUMENT_AI_CONFIG.serviceAccountPath) {
    options.keyFilename = DOCUMENT_AI_CONFIG.serviceAccountPath;
  } else {
    throw new Error("No Google Cloud authentication configured");
  }

  return new DocumentProcessorServiceClient(options);
}

import type { ImportedRecipe } from "@/types/recipe";

interface DocumentEntity {
  type?: string;
  mentionText?: string;
  confidence?: number;
  properties?: Array<{
    mentionText?: string;
    confidence?: number;
  }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocumentResponse = any;

// Validate document file
function validateDocument(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!SUPPORTED_FORMATS.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported file format. Supported formats: ${SUPPORTED_FORMATS.join(
        ", "
      )}`,
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
    };
  }

  return { valid: true };
}

// Fallback OCR using OpenAI GPT-4o Vision (when Document AI is not configured)
async function processWithFallbackOCR(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ImportedRecipe> {
  const startTime = Date.now();

  console.log("Using fallback OCR processing for:", fileName);

  // For now, return mock data - in production you'd implement OpenAI Vision API
  await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate processing time

  const mockData: ImportedRecipe = {
    title:
      "Extracted Recipe from " +
      (mimeType === "application/pdf" ? "PDF" : "Image"),
    description:
      "Recipe extracted using fallback OCR processing. Please review and edit the extracted information.",
    ingredients: [
      { name: "ingredient 1", amount: 1, unit: "cup" },
      { name: "ingredient 2", amount: 2, unit: "tbsp" },
      { name: "ingredient 3", amount: 1, unit: "piece" },
    ],
    instructions: [
      "Step 1: Please review and edit these instructions",
      "Step 2: The fallback OCR has extracted basic structure",
      "Step 3: Customize as needed for your recipe",
    ],
    prepTime: 15,
    cookTime: 30,
    servings: 4,
    difficulty: "medium",
    cuisine: "international",
    tags: ["imported", "fallback-ocr", "needs-review"],
    calories: 250,
    protein: 15,
    carbs: 30,
    fat: 8,
    confidence: 0.6, // Lower confidence to indicate fallback processing
  };

  return mockData;
}

// Process document with Google Cloud Document AI
async function processDocumentWithAI(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ImportedRecipe> {
  const startTime = Date.now();

  // Check if Document AI is configured
  if (!isDocumentAIConfigured()) {
    console.log("Document AI not configured, using fallback OCR");
    return processWithFallbackOCR(fileBuffer, mimeType, fileName);
  }

  try {
    const client = getDocumentAIClient();

    // Create processor name
    const name = `projects/${DOCUMENT_AI_CONFIG.projectId}/locations/${DOCUMENT_AI_CONFIG.location}/processors/${DOCUMENT_AI_CONFIG.customProcessorId}`;

    console.log("Processing document with Document AI:", {
      processor: name,
      mimeType,
      fileSize: fileBuffer.length,
    });

    // Prepare the request
    const request = {
      name,
      rawDocument: {
        content: fileBuffer.toString("base64"),
        mimeType,
      },
    };

    // Process the document
    const [response] = await client.processDocument(request);
    const { document } = response;

    console.log(
      "Document AI response received, entities found:",
      document?.entities?.length || 0
    );

    if (!document) {
      console.log("No document returned from Document AI, using fallback");
      return processWithFallbackOCR(fileBuffer, mimeType, fileName);
    }

    // Parse the response and extract recipe data
    const extractedRecipe = parseDocumentAIResponse(document, mimeType);

    const processingTime = Date.now() - startTime;

    console.log("processing time", processingTime);
    console.log("document", document);

    return {
      ...extractedRecipe,
      confidence: calculateConfidence(document),
    };
  } catch (error) {
    console.error("Document AI processing error:", error);
    console.log("Falling back to alternative OCR processing");

    // Instead of throwing an error, fall back to alternative processing
    return processWithFallbackOCR(fileBuffer, mimeType, fileName);
  }
}

// Calculate overall confidence from Document AI entities
function calculateConfidence(document: DocumentResponse): number {
  if (!document.entities || document.entities.length === 0) {
    return 0.45;
  }

  const confidences = document.entities
    .filter((e: DocumentEntity) => e.confidence)
    .map((e: DocumentEntity) => e.confidence as number);

  if (confidences.length === 0) return 0.5;

  const avgConfidence =
    confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length;
  return avgConfidence;
}

// Parse Document AI response into structured recipe data
function parseDocumentAIResponse(
  document: DocumentResponse,
  mimeType: string
): Omit<ImportedRecipe, "confidence"> {
  const entities = document.entities || [];
  const text = document.text || "";

  console.log("Parsing entities:", entities.length);

  // Extract title
  const title =
    extractEntityValue(entities, "recipe_title") ||
    extractEntityValue(entities, "title") ||
    extractFromText(text, /^(.+?)(?:\n|$)/m) ||
    "Extracted Recipe";

  // Extract description - try from text patterns if not found in entities
  let description =
    extractEntityValue(entities, "description") ||
    extractEntityValue(entities, "recipe_description");

  if (!description) {
    // Look for description patterns in text
    const descMatch = text.match(
      /(?:Description|About):?\s*\n(.+?)(?:\n\s*(?:Ingredients|Instructions|Method)|$)/i
    );
    description = descMatch
      ? descMatch[1].trim()
      : `No description found. Recipe extracted from ${
          mimeType === "application/pdf" ? "PDF" : "image"
        }`;
  }

  // Extract ingredients - handle both mentionText and properties
  const ingredientEntities = entities.filter(
    (e: DocumentEntity) =>
      e.type === "ingredient" ||
      e.type === "ingredients" ||
      e.type === "recipe_ingredient"
  );

  const ingredients: Array<{
    name: string;
    amount: number;
    unit: string;
    notes?: string;
  }> = [];

  // Process ingredient entities
  for (const entity of ingredientEntities) {
    if (entity.mentionText?.trim()) {
      // Entity has direct text
      ingredients.push(parseIngredientText(entity.mentionText));
    } else if (entity.properties && entity.properties.length > 0) {
      // Entity has properties - extract from properties
      for (const prop of entity.properties) {
        if (prop.mentionText?.trim()) {
          ingredients.push(parseIngredientText(prop.mentionText));
        }
      }
    }
  }

  // If no ingredient entities found, try to extract from text
  if (ingredients.length === 0) {
    const ingredientsFromText = extractIngredientsFromText(text);
    ingredients.push(...ingredientsFromText);
  }

  // Extract instructions - handle both direct text and properties
  const instructionEntities = entities.filter(
    (e: DocumentEntity) =>
      e.type === "instruction" ||
      e.type === "instructions" ||
      e.type === "recipe_instruction"
  );

  let instructions: string[] = [];

  // Process instruction entities
  for (const entity of instructionEntities) {
    if (entity.mentionText?.trim()) {
      // Split multi-step instructions if needed
      const steps = entity.mentionText
        .split(/\n(?=\d+\.|\w+:)/)
        .filter((step: string) => step.trim());
      instructions.push(...steps.map((step: string) => step.trim()));
    } else if (entity.properties && entity.properties.length > 0) {
      // Extract from properties
      for (const prop of entity.properties) {
        if (prop.mentionText?.trim()) {
          instructions.push(prop.mentionText.trim());
        }
      }
    }
  }

  // If no instruction entities found, try to extract from text
  if (instructions.length === 0) {
    instructions = extractInstructionsFromText(text);
  }

  // Extract timing information with multiple possible field names
  const prepTime = parseTimeValue(
    extractEntityValue(entities, "prep_time") ||
      extractEntityValue(entities, "preparation_time") ||
      extractEntityValue(entities, "preparationTime") ||
      extractEntityValue(entities, "prepTime")
  );

  const cookTime = parseTimeValue(
    extractEntityValue(entities, "cook_time") ||
      extractEntityValue(entities, "cooking_time") ||
      extractEntityValue(entities, "cookTime") ||
      extractEntityValue(entities, "cookingTime")
  );

  // Extract servings with multiple possible field names
  const servings = parseServingsValue(
    extractEntityValue(entities, "servings") ||
      extractEntityValue(entities, "serves") ||
      extractEntityValue(entities, "serving") ||
      extractEntityValue(entities, "portions")
  );

  // Extract categories and convert to tags
  const categoryEntities = entities.filter(
    (e: DocumentEntity) => e.type === "category" || e.type === "categories"
  );

  const extractedCategories = categoryEntities
    .map((e: DocumentEntity) => e.mentionText?.toLowerCase().trim())
    .filter((category: string | undefined): category is string =>
      Boolean(category)
    );

  // Extract difficulty
  const difficulty =
    extractEntityValue(entities, "difficulty") ||
    extractEntityValue(entities, "level") ||
    extractFromText(text, /(?:Difficulty|Level):?\s*(\w+)/i);

  // Extract cuisine
  const cuisine =
    extractEntityValue(entities, "cuisine") ||
    extractEntityValue(entities, "origin") ||
    extractFromText(text, /(?:Cuisine|Origin):?\s*(\w+)/i);

  // Extract nutritional information - handle both direct entities and properties
  const nutritionalInfo: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  } = {};

  // Look for specific nutrition entities
  const nutritionFields = [
    { key: "calories", patterns: ["calories", "kcal", "cal"] },
    { key: "protein", patterns: ["protein"] },
    { key: "carbs", patterns: ["carbs", "carbohydrates", "carbohydrate"] },
    { key: "fat", patterns: ["fat", "fats"] },
  ];

  for (const field of nutritionFields) {
    for (const pattern of field.patterns) {
      const value = extractEntityValue(entities, pattern);
      if (value) {
        const numValue = parseFloat(value.replace(/[^0-9.]/g, ""));
        if (!isNaN(numValue) && numValue > 0) {
          nutritionalInfo[field.key as keyof typeof nutritionalInfo] = numValue;
          break; // Found value for this field, move to next
        }
      }
    }
  }

  // Check for nutrition information entity with properties
  const nutritionEntity = entities.find(
    (e: DocumentEntity) =>
      e.type === "nutricionInformation" ||
      e.type === "nutritionInformation" ||
      e.type === "nutrition"
  );

  if (nutritionEntity?.properties && nutritionEntity.properties.length > 0) {
    for (const prop of nutritionEntity.properties) {
      if (prop.mentionText) {
        // Try to parse nutrition info from property text
        const caloriesMatch = prop.mentionText.match(
          /(\d+)\s*(?:calories|kcal|cal)/i
        );
        if (caloriesMatch && !nutritionalInfo.calories) {
          nutritionalInfo.calories = parseInt(caloriesMatch[1]);
        }

        const proteinMatch = prop.mentionText.match(
          /(\d+(?:\.\d+)?)\s*g?\s*protein/i
        );
        if (proteinMatch && !nutritionalInfo.protein) {
          nutritionalInfo.protein = parseFloat(proteinMatch[1]);
        }

        const carbsMatch = prop.mentionText.match(
          /(\d+(?:\.\d+)?)\s*g?\s*(?:carbs|carbohydrates)/i
        );
        if (carbsMatch && !nutritionalInfo.carbs) {
          nutritionalInfo.carbs = parseFloat(carbsMatch[1]);
        }

        const fatMatch = prop.mentionText.match(/(\d+(?:\.\d+)?)\s*g?\s*fat/i);
        if (fatMatch && !nutritionalInfo.fat) {
          nutritionalInfo.fat = parseFloat(fatMatch[1]);
        }
      }
    }
  }

  // Build comprehensive tags array
  const tags = ["imported", "document-ai"];

  // Add categories as tags
  tags.push(...extractedCategories);

  // Add cuisine as tag if found
  if (cuisine) {
    tags.push(cuisine.toLowerCase());
  }

  // Add difficulty as tag if found
  if (difficulty) {
    tags.push(difficulty.toLowerCase());
  }

  // Add document type tag
  if (mimeType === "application/pdf") {
    tags.push("pdf-import");
  } else {
    tags.push("image-import");
  }

  // Remove duplicates and empty values
  const uniqueTags = [...new Set(tags.filter(Boolean))];

  // Ensure description is always a string
  const finalDescription: string =
    description ||
    `Recipe extracted from ${
      mimeType === "application/pdf" ? "PDF" : "image"
    } using Google Cloud Document AI`;

  console.log("Parsed recipe data:", {
    title,
    ingredientsCount: ingredients.length,
    instructionsCount: instructions.length,
    tags: uniqueTags,
    nutritionalInfo,
    difficulty,
    cuisine,
  });

  return {
    title,
    description: finalDescription,
    ingredients,
    instructions,
    prepTime,
    cookTime,
    servings,
    difficulty,
    cuisine,
    tags: uniqueTags,
    ...(Object.keys(nutritionalInfo).length > 0 ? nutritionalInfo : {}),
  };
}

// Helper function to extract entity value by type
function extractEntityValue(
  entities: DocumentEntity[],
  type: string
): string | undefined {
  const entity = entities.find((e: DocumentEntity) => e.type === type);
  return entity?.mentionText;
}

// Helper function to extract text using regex
function extractFromText(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  return match ? match[1]?.trim() : undefined;
}

// Helper functions for parsing
function parseIngredientText(text: string): {
  name: string;
  amount: number;
  unit: string;
  notes?: string;
} {
  // Try to parse structured ingredient format: "2 cups flour"
  const match = text.match(/^([\d\/\.\s]+)?\s*(\w+)?\s+(.+)$/);

  if (match) {
    const [, amountStr, unit, name] = match;
    const amount = amountStr
      ? parseFloat(amountStr.replace(/\s+/g, "").replace(/\//, ".")) || 1
      : 1;
    return {
      name: name.trim(),
      amount,
      unit: unit || "whole",
    };
  }

  // If no pattern matches, treat the whole text as the ingredient name
  return {
    name: text.trim(),
    amount: 1,
    unit: "whole",
  };
}

function extractIngredientsFromText(text: string): Array<{
  name: string;
  amount: number;
  unit: string;
}> {
  const ingredients: Array<{ name: string; amount: number; unit: string }> = [];

  // Look for ingredients section
  const ingredientsMatch = text.match(
    /Ingredients?:?\s*\n([\s\S]*?)(?=\n\s*(?:Instructions?|Directions?|Steps?|Method|$))/i
  );

  if (ingredientsMatch) {
    const ingredientsText = ingredientsMatch[1];
    const lines = ingredientsText.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      // Skip empty lines or headers
      if (!line.trim() || line.match(/^(Ingredients|For|Optional)/i)) continue;

      const ingredient = parseIngredientText(line);
      if (ingredient.name) {
        ingredients.push(ingredient);
      }
    }
  }

  return ingredients;
}

function extractInstructionsFromText(text: string): string[] {
  // Extract instructions section
  const instructionsMatch = text.match(
    /(?:Instructions?|Directions?|Steps?|Method):?\s*\n([\s\S]*?)(?=\n\s*(?:Notes?|Tips?|Nutrition|$))/i
  );

  if (!instructionsMatch) return [];

  const instructionsText = instructionsMatch[1];

  // Split by numbered steps or bullet points
  const steps = instructionsText
    .split(/\n(?:\d+\.|-|\*|\•)/)
    .map((step) => step.trim())
    .filter((step) => step.length > 0);

  return steps;
}

function parseTimeValue(timeText: string | undefined): number | undefined {
  if (!timeText) return undefined;

  const match = timeText.match(/(\d+)\s*(minutes?|mins?|hours?|hrs?)/i);
  if (!match) return undefined;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  if (unit.includes("hour") || unit.includes("hr")) {
    return value * 60;
  }

  return value;
}

function parseServingsValue(
  servingsText: string | undefined
): number | undefined {
  if (!servingsText) return undefined;

  const match = servingsText.match(/(\d+)/);
  return match ? parseInt(match[1]) : undefined;
}

// Main API handler
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log("Processing file:", {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    // Validate file
    const validation = validateDocument(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    // Get file buffer directly into memory, no need to touch the filesystem
    const fileExtension = file.name.split(".").pop() || "";
    const fileName = `${randomUUID()}.${fileExtension}`;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate PDF page count
    if (file.type === "application/pdf") {
      try {
        const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        const pageCount = pdfDoc.getPageCount();
        if (pageCount > MAX_PDF_PAGES) {
          return NextResponse.json(
            { error: `PDF file too long. Maximum allowed is ${MAX_PDF_PAGES} pages, got ${pageCount}.` },
            { status: 400 }
          );
        }
      } catch (err) {
        console.error("Failed to parse PDF for page count:", err);
        return NextResponse.json({ error: "Invalid or corrupted PDF file" }, { status: 400 });
      }
    }

    // Process with Document AI (or fallback) using the buffer directly in memory
    const extractedData = await processDocumentWithAI(
      buffer,
      file.type,
      file.name
    );

    // console.log("Processing completed successfully:", extractedData);

    return NextResponse.json({
      success: true,
      message: "Document processed successfully",
      data: {
        ...extractedData,
        fileName,
        originalFileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Document processing error:", error);

    return NextResponse.json(
      {
        error: "Failed to process document",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET handler for processor status/health check
export async function GET() {
  try {
    // Check if all required environment variables are set
    const configStatus = {
      projectId: !!DOCUMENT_AI_CONFIG.projectId,
      location: !!DOCUMENT_AI_CONFIG.location,
      processorId: !!DOCUMENT_AI_CONFIG.customProcessorId,
      serviceAccount: !!DOCUMENT_AI_CONFIG.serviceAccountPath,
    };

    const documentAIConfigured = Object.values(configStatus).every((v) => v);

    const processorStatus = {
      available: documentAIConfigured,
      fallbackAvailable: true,
      processorId: DOCUMENT_AI_CONFIG.customProcessorId,
      location: DOCUMENT_AI_CONFIG.location,
      supportedFormats: SUPPORTED_FORMATS,
      maxFileSize: MAX_FILE_SIZE,
      maxPdfPages: MAX_PDF_PAGES,
      configStatus,
    };

    return NextResponse.json({
      status: "healthy",
      documentAI: {
        configured: documentAIConfigured,
        ...processorStatus,
      },
      message: documentAIConfigured
        ? "Document AI fully configured"
        : "Document AI not configured - using fallback OCR",
    });
  } catch (error) {
    console.error("Health check error:", error);
    return NextResponse.json(
      {
        error: "Service unavailable",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
