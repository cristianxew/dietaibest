import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

// Supported image formats
const SUPPORTED_FORMATS = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Validate image file
function validateImageFile(
  fileType: string,
  fileSize: number
): { isValid: boolean; error?: string } {
  // Check file type
  if (!SUPPORTED_FORMATS.includes(fileType)) {
    return {
      isValid: false,
      error: `Invalid file format. Supported formats: ${SUPPORTED_FORMATS.map(
        (f) => f.split("/")[1].toUpperCase()
      ).join(", ")}`,
    };
  }

  // Check file size
  if (fileSize > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  return { isValid: true };
}

// Mock OCR processing function
// In production, this would integrate with a real OCR service (e.g., Google Cloud Vision, AWS Textract)
async function processImageWithOCR(_imagePath: string): Promise<{
  extractedText: string;
  recipeData?: {
    title: string;
    description?: string;
    ingredients: Array<{
      name: string;
      amount: number;
      unit: string;
    }>;
    instructions: string[];
    prepTime?: number;
    cookTime?: number;
    servings?: number;
  };
}> {
  // Simulate OCR processing delay
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Mock extracted text and parsed recipe data
  // In production, this would be the actual OCR result
  const mockExtractedText = `
    Classic Chocolate Chip Cookies
    
    These delicious homemade chocolate chip cookies are crispy on the outside and chewy on the inside.
    
    Ingredients:
    - 2 1/4 cups all-purpose flour
    - 1 tsp baking soda
    - 1 tsp salt
    - 1 cup butter, softened
    - 3/4 cup granulated sugar
    - 3/4 cup packed brown sugar
    - 2 large eggs
    - 2 tsp vanilla extract
    - 2 cups chocolate chips
    
    Instructions:
    1. Preheat oven to 375°F (190°C).
    2. In a small bowl, mix flour, baking soda, and salt.
    3. In a large bowl, beat butter and sugars until creamy.
    4. Add eggs and vanilla to butter mixture and mix well.
    5. Gradually stir in flour mixture.
    6. Stir in chocolate chips.
    7. Drop rounded tablespoons of dough onto ungreased cookie sheets.
    8. Bake 9-11 minutes or until golden brown.
    9. Cool on baking sheets for 2 minutes before removing to wire racks.
    
    Prep Time: 15 minutes
    Cook Time: 10 minutes
    Servings: 48 cookies
  `;

  // Mock parsed recipe data
  // In production, this would use NLP to extract structured data from OCR text
  const mockRecipeData = {
    title: "Classic Chocolate Chip Cookies",
    description:
      "These delicious homemade chocolate chip cookies are crispy on the outside and chewy on the inside.",
    ingredients: [
      { name: "All-purpose flour", amount: 2.25, unit: "cups" },
      { name: "Baking soda", amount: 1, unit: "tsp" },
      { name: "Salt", amount: 1, unit: "tsp" },
      { name: "Butter, softened", amount: 1, unit: "cup" },
      { name: "Granulated sugar", amount: 0.75, unit: "cup" },
      { name: "Packed brown sugar", amount: 0.75, unit: "cup" },
      { name: "Large eggs", amount: 2, unit: "whole" },
      { name: "Vanilla extract", amount: 2, unit: "tsp" },
      { name: "Chocolate chips", amount: 2, unit: "cups" },
    ],
    instructions: [
      "Preheat oven to 375°F (190°C).",
      "In a small bowl, mix flour, baking soda, and salt.",
      "In a large bowl, beat butter and sugars until creamy.",
      "Add eggs and vanilla to butter mixture and mix well.",
      "Gradually stir in flour mixture.",
      "Stir in chocolate chips.",
      "Drop rounded tablespoons of dough onto ungreased cookie sheets.",
      "Bake 9-11 minutes or until golden brown.",
      "Cool on baking sheets for 2 minutes before removing to wire racks.",
    ],
    prepTime: 15,
    cookTime: 10,
    servings: 48,
  };

  return {
    extractedText: mockExtractedText,
    recipeData: mockRecipeData,
  };
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file
    const validation = validateImageFile(file.type, file.size);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Generate unique filename
    const fileExtension = file.name.split(".").pop() || "jpg";
    const uniqueFileName = `${randomUUID()}.${fileExtension}`;

    // Create upload directory if it doesn't exist
    const uploadDir = join(process.cwd(), "uploads", "recipes", "images");
    await mkdir(uploadDir, { recursive: true });

    // Save file to disk
    const filePath = join(uploadDir, uniqueFileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Process image with OCR
    try {
      const ocrResult = await processImageWithOCR(filePath);

      // Return success response with extracted data
      return NextResponse.json({
        success: true,
        data: {
          fileName: uniqueFileName,
          filePath: `/uploads/recipes/images/${uniqueFileName}`,
          extractedText: ocrResult.extractedText,
          ...ocrResult.recipeData,
        },
        message: "Image uploaded and processed successfully",
      });
    } catch (ocrError) {
      console.error("OCR processing error:", ocrError);

      // Return partial success - file uploaded but OCR failed
      return NextResponse.json({
        success: true,
        data: {
          fileName: uniqueFileName,
          filePath: `/uploads/recipes/images/${uniqueFileName}`,
        },
        warnings: [
          "Image uploaded but text extraction failed. Please enter recipe details manually.",
        ],
      });
    }
  } catch (error) {
    console.error("Image upload error:", error);

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

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
