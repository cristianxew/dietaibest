/**
 * Server Actions for Nutrition Analysis
 *
 * Provides server-side functions for analyzing recipe nutrition
 * with authentication and error handling built-in. Calculation is USDA
 * FoodData Central only (ADR 0003) — the Edamam path has been retired.
 */

"use server";

import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { assertCanCreateRecipe } from "@/lib/entitlements";
import { toEntitlementError } from "@/lib/entitlement-error";
import { analyzeRecipeProfileAction } from "@/actions/analyzeRecipe";
import type { Profile } from "@/lib/fdc";

// ============================================================================
// Helper Functions
// ============================================================================

async function getAuthenticatedUser() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Analyze a recipe into the full USDA FDC profile for the create/edit form.
 *
 * Returns the per-serving 22-nutrient profile so the form can pre-fill every
 * macro/micro field. Gated by `assertCanCreateRecipe` (same gate as the save).
 * This is the USDA FDC engine (ADR 0003) — no Edamam call is made.
 */
export async function analyzeRecipeProfileForFormAction(input: {
  ingredients: string[];
  servings: number;
}): Promise<{
  success: boolean;
  data?: Profile;
  error?: string;
  code?: string;
}> {
  try {
    const user = await getAuthenticatedUser();
    await assertCanCreateRecipe(user);

    const result = await analyzeRecipeProfileAction(input);
    if (!result.success) {
      return { success: false, error: result.error ?? "Analysis failed" };
    }

    return { success: true, data: result.perServing };
  } catch (error) {
    const entError = toEntitlementError(error);
    if (entError) {
      return {
        success: false,
        error: JSON.stringify(entError),
        code: entError.code,
      };
    }
    console.error("[Action] analyzeRecipeProfileForForm failed:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to analyze recipe",
    };
  }
}
