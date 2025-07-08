import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

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

// Simple extraction function (to be enhanced with actual scraping logic)
async function extractRecipeFromUrl(url: string) {
  // Check URL reachability with a timeout
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

    // For now, return mock data with domain-specific variations
    // In a real implementation, this would scrape the actual recipe data
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace("www.", "");

    // Simulate different recipe structures based on domain
    interface MockRecipeData {
      title: string;
      description: string;
      prepTime: number;
      cookTime: number;
      servings: number;
      difficulty: string;
      ingredients: Array<{
        name: string;
        amount: number;
        unit: string;
      }>;
      instructions: string[];
      tags: string[];
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }

    const mockRecipes: Record<string, MockRecipeData> = {
      "allrecipes.com": {
        title: "Classic Chicken Parmesan",
        description:
          "A crispy breaded chicken breast topped with marinara sauce and melted mozzarella cheese",
        prepTime: 20,
        cookTime: 30,
        servings: 4,
        difficulty: "medium",
        ingredients: [
          { name: "Chicken breasts", amount: 4, unit: "pieces" },
          { name: "Breadcrumbs", amount: 1, unit: "cup" },
          { name: "Parmesan cheese", amount: 0.5, unit: "cup" },
          { name: "Eggs", amount: 2, unit: "whole" },
          { name: "Marinara sauce", amount: 2, unit: "cups" },
          { name: "Mozzarella cheese", amount: 1, unit: "cup" },
          { name: "Olive oil", amount: 0.25, unit: "cup" },
        ],
        instructions: [
          "Pound chicken breasts to even thickness",
          "Set up breading station with flour, beaten eggs, and breadcrumb mixture",
          "Coat chicken in flour, then egg, then breadcrumbs",
          "Heat olive oil in a large skillet over medium-high heat",
          "Cook chicken until golden brown on both sides",
          "Transfer to baking dish and top with marinara and mozzarella",
          "Bake at 375°F for 20 minutes until cheese is melted and bubbly",
        ],
        tags: ["italian", "chicken", "cheese", "comfort food"],
        calories: 420,
        protein: 38,
        carbs: 22,
        fat: 18,
      },
      default: {
        title: `Imported Recipe from ${domain}`,
        description: "A delicious recipe imported from the web",
        prepTime: 15,
        cookTime: 30,
        servings: 4,
        difficulty: "medium",
        ingredients: [
          { name: "Main ingredient", amount: 1, unit: "lb" },
          { name: "Secondary ingredient", amount: 2, unit: "cups" },
          { name: "Seasoning", amount: 1, unit: "tbsp" },
          { name: "Liquid", amount: 1, unit: "cup" },
        ],
        instructions: [
          "Prepare all ingredients",
          "Combine ingredients according to recipe",
          "Cook until done",
          "Serve and enjoy",
        ],
        tags: ["imported"],
        calories: 350,
        protein: 25,
        carbs: 30,
        fat: 15,
      },
    };

    // Select appropriate mock data based on domain
    const recipeData = domain.includes("allrecipes.com")
      ? mockRecipes["allrecipes.com"]
      : mockRecipes["default"];

    // Add source URL and metadata
    return {
      ...recipeData,
      sourceUrl: url,
      importedFrom: domain,
      importedAt: new Date().toISOString(),
    };
  } catch (error) {
    clearTimeout(timeout);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error("URL request timed out");
      }
      throw error;
    }
    throw new Error("Failed to fetch URL");
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    try {
      // Extract recipe data
      const recipeData = await extractRecipeFromUrl(url);

      return NextResponse.json({
        success: true,
        data: recipeData,
        warnings: isSupported
          ? []
          : [
              "This website might not be fully supported. Extraction results may vary.",
            ],
      });
    } catch (extractError) {
      console.error("Recipe extraction error:", extractError);

      return NextResponse.json(
        {
          error:
            extractError instanceof Error
              ? extractError.message
              : "Failed to extract recipe from URL",
          details:
            "The website might not be accessible or doesn't contain a valid recipe format.",
        },
        { status: 422 }
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
