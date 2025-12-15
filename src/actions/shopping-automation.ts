"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import {
  getBrowserUseClient,
  SupportedStore,
  SUPPORTED_STORES,
} from "@/lib/browser-use";
import { ShoppingListIngredient } from "@/types/shopping-list";
import {
  shoppingPreferencesSchema,
  ShoppingPreferencesInput,
  StoreInfo,
} from "@/types/shopping-preferences";
import { prisma } from "@/lib/prisma";

// ============================================================================
// Validation Schemas
// ============================================================================

const shoppingAutomationSchema = z.object({
  store: z.enum(["auchan", "frisco", "carrefour"]),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        amount: z.number().positive(),
        unit: z.string().min(1),
        category: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .min(1, "At least one item is required"),
  preferences: z
    .object({
      preferOrganic: z.boolean().optional(),
      preferStoreBrand: z.boolean().optional(),
      allowSubstitutions: z.boolean().optional(),
      maxPricePerItem: z.number().positive().optional(),
    })
    .optional(),
  credentials: z
    .object({
      email: z.string().email().optional(),
    })
    .optional(),
});

export type ShoppingAutomationInput = z.infer<typeof shoppingAutomationSchema>;

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Start a shopping automation task
 * Validates user session, constructs Browser-Use payload, and returns taskId
 */
export async function startShoppingTask(input: ShoppingAutomationInput) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return { data: null, error: "Unauthorized" };
    }

    // Validate input
    const validation = shoppingAutomationSchema.safeParse(input);
    if (!validation.success) {
      return {
        data: null,
        error: validation.error.errors[0].message,
      };
    }

    const { store, items, preferences, credentials } = validation.data;

    console.log(
      `[Shopping Automation] Starting task for ${store} with ${items.length} items`
    );

    const browserUseClient = getBrowserUseClient();
    const { taskId, sessionId, liveUrl, browserSessionId } = await browserUseClient.startShoppingAutomation(
      {
        store: store as SupportedStore,
        items,
        preferences,
        credentials,
      }
    );

    console.log(`[Shopping Automation] Task started: ${taskId}, liveUrl: ${liveUrl}`);

    return {
      data: { taskId, sessionId, store, itemCount: items.length, liveUrl, browserSessionId },
      error: null,
    };
  } catch (error) {
    console.error("[Shopping Automation] Error starting task:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to start shopping automation",
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert ShoppingListIngredient[] to the format expected by shopping automation
 * This helper transforms the shopping list result from the meal plan into
 * the format required by the Browser-Use shopping automation
 * Note: This is a private helper - not exported as server actions must be async
 */
function convertToShoppingItems(
  ingredients: ShoppingListIngredient[]
): ShoppingAutomationInput["items"] {
  return ingredients.map((ing) => ({
    name: ing.name,
    amount: ing.amount,
    unit: ing.unit,
    category: ing.category,
    notes:
      ing.originalNames.length > 1
        ? `Also known as: ${ing.originalNames.slice(1).join(", ")}`
        : undefined,
  }));
}

// ============================================================================
// Shopping Preferences CRUD
// ============================================================================

/**
 * Get user's shopping preferences
 * Returns null if no preferences are saved yet
 */
export async function getShoppingPreferences() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return { data: null, error: "Unauthorized" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { shoppingPreferences: true },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    return { data: user.shoppingPreferences, error: null };
  } catch (error) {
    console.error("[Shopping Preferences] Error fetching preferences:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch shopping preferences",
    };
  }
}

/**
 * Update user's shopping preferences
 * Creates new preferences if none exist, otherwise updates existing
 */
export async function updateShoppingPreferences(input: ShoppingPreferencesInput) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return { data: null, error: "Unauthorized" };
    }

    // Validate input
    const validation = shoppingPreferencesSchema.safeParse(input);
    if (!validation.success) {
      return {
        data: null,
        error: validation.error.errors[0].message,
      };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    const {
      selectedStore,
      deliveryPreference,
      zipCode,
      preferOrganic,
      preferStoreBrand,
      allowSubstitutions,
      maxPricePerItem,
    } = validation.data;

    // Upsert shopping preferences
    const preferences = await prisma.shoppingPreferences.upsert({
      where: { userId: user.id },
      update: {
        selectedStore: selectedStore ?? null,
        deliveryPreference,
        zipCode: zipCode ?? null,
        preferOrganic,
        preferStoreBrand,
        allowSubstitutions,
        maxPricePerItem: maxPricePerItem ?? null,
      },
      create: {
        userId: user.id,
        selectedStore: selectedStore ?? null,
        deliveryPreference,
        zipCode: zipCode ?? null,
        preferOrganic,
        preferStoreBrand,
        allowSubstitutions,
        maxPricePerItem: maxPricePerItem ?? null,
      },
    });

    console.log(
      `[Shopping Preferences] Updated preferences for user ${user.id}`
    );

    revalidatePath("/shopping");

    return { data: preferences, error: null };
  } catch (error) {
    console.error("[Shopping Preferences] Error updating preferences:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update shopping preferences",
    };
  }
}

/**
 * Get list of available stores with their configuration
 * All stores are currently available for Polish market
 */
export async function getAvailableStores(): Promise<{
  data: StoreInfo[] | null;
  error: string | null;
}> {
  try {
    const stores: StoreInfo[] = Object.values(SUPPORTED_STORES).map((store) => ({
      id: store.id,
      name: store.name,
      domains: store.domains,
      startUrl: store.startUrl,
      country: store.country,
      supportsSubstitutions: store.supportsSubstitutions,
      automationSupport: "full" as const, // All Polish stores have full automation
    }));

    return { data: stores, error: null };
  } catch (error) {
    console.error("[Shopping Preferences] Error fetching stores:", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to fetch available stores",
    };
  }
}
