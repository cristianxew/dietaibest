/**
 * FDC Search API Route
 * Provides ingredient autocomplete suggestions from USDA FDC
 * Server-side only to protect API key
 *
 * @module api/fdc/search
 */

import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { searchFoodsCached } from "@/lib/fdcRepo";

export const runtime = "nodejs";

/**
 * Search request body schema
 */
interface SearchRequestBody {
  query: string;
}

/**
 * Simplified search result for autocomplete
 */
interface SearchResponseItem {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
}

/**
 * POST /api/fdc/search
 * Search USDA FDC for ingredient autocomplete suggestions
 *
 * @param request - Next.js request object
 * @returns JSON array of matching food items (max 8 results)
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    let body: SearchRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { query } = body;

    // Validate query parameter
    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query parameter is required and must be a string" },
        { status: 400 }
      );
    }

    if (query.trim().length === 0) {
      return NextResponse.json(
        { error: "Query parameter cannot be empty" },
        { status: 400 }
      );
    }

    if (query.length > 200) {
      return NextResponse.json(
        { error: "Query parameter is too long (max 200 characters)" },
        { status: 400 }
      );
    }

    console.log(`[FDC Search API] Searching for: "${query}"`);

    // Call FDC search (DB-cached by normalized query)
    const foods = await searchFoodsCached(query.trim());

    // Return first 8 results with simplified structure
    const simplified: SearchResponseItem[] = foods.slice(0, 8).map((food) => ({
      fdcId: food.fdcId,
      description: food.description,
      dataType: food.dataType,
      brandOwner: food.brandOwner,
    }));

    console.log(`[FDC Search API] Found ${simplified.length} results`);

    return NextResponse.json(simplified, { status: 200 });
  } catch (error) {
    // Log detailed error server-side
    console.error("[FDC Search API] Error during search:", error);

    // Return user-friendly error message
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to search USDA FDC database",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/fdc/search
 * Not supported - use POST instead
 */
export async function GET() {
  return NextResponse.json(
    {
      error: "Method not allowed. Use POST with JSON body: { query: string }",
    },
    { status: 405 }
  );
}
