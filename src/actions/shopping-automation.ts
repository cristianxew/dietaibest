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
  storeCredentialSchema,
  StoreCredentialInput,
  StoreCredential,
  SupportedStore as SupportedStoreType,
} from "@/types/shopping-preferences";
import { prisma } from "@/lib/prisma";
import { encryptPassword, decryptPassword } from "@/lib/encryption";

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
 * If user has stored credentials for the store, will auto-login first
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

    const { store, items, preferences } = validation.data;

    // Fetch user and check for stored credentials
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        storeCredentials: {
          where: { store },
        },
      },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    // Prepare credentials for Browser-Use if available
    let credentials: { email?: string } | undefined;
    let secrets: Record<string, string> | undefined;
    let hasStoredCredentials = false;

    const storedCredential = user.storeCredentials[0];
    if (storedCredential) {
      try {
        // Decrypt the password
        const decryptedPassword = decryptPassword({
          encryptedPassword: storedCredential.encryptedPassword,
          iv: storedCredential.iv,
          authTag: storedCredential.authTag,
        });

        credentials = { email: storedCredential.email };
        secrets = {
          store_email: storedCredential.email,
          store_password: decryptedPassword,
        };
        hasStoredCredentials = true;

        console.log(
          `[Shopping Automation] Using stored credentials for ${store} (email: ${storedCredential.email})`
        );
      } catch (decryptError) {
        console.error("[Shopping Automation] Failed to decrypt credentials:", decryptError);
        // Continue without credentials if decryption fails
      }
    }

    console.log(
      `[Shopping Automation] Starting task for ${store} with ${items.length} items, hasCredentials: ${hasStoredCredentials}`
    );

    const browserUseClient = getBrowserUseClient();
    const { taskId, sessionId, liveUrl, browserSessionId } = await browserUseClient.startShoppingAutomation(
      {
        store: store as SupportedStore,
        items,
        preferences,
        credentials,
        hasStoredCredentials,
      },
      secrets
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
function _convertToShoppingItems(
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

// ============================================================================
// Store Credentials CRUD
// ============================================================================

/**
 * Save store credentials (encrypted)
 * Creates new credentials if none exist, otherwise updates existing
 */
export async function saveStoreCredentials(
  input: StoreCredentialInput
): Promise<{ data: StoreCredential | null; error: string | null }> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return { data: null, error: "Unauthorized" };
    }

    // Validate input
    const validation = storeCredentialSchema.safeParse(input);
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

    const { store, email, password } = validation.data;

    // Encrypt the password
    const { encryptedPassword, iv, authTag } = encryptPassword(password);

    // Upsert the credential
    const credential = await prisma.storeCredential.upsert({
      where: {
        userId_store: {
          userId: user.id,
          store,
        },
      },
      update: {
        email,
        encryptedPassword,
        iv,
        authTag,
      },
      create: {
        userId: user.id,
        store,
        email,
        encryptedPassword,
        iv,
        authTag,
      },
    });

    console.log(
      `[Store Credentials] Saved credentials for ${store} (user: ${user.id})`
    );

    revalidatePath("/settings");

    return {
      data: {
        id: credential.id,
        store: credential.store as SupportedStoreType,
        email: credential.email,
        hasPassword: true,
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt,
      },
      error: null,
    };
  } catch (error) {
    console.error("[Store Credentials] Error saving credentials:", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to save credentials",
    };
  }
}

/**
 * Get saved credentials for a store (email only, never expose password)
 * @param store - Optional store filter. If not provided, returns all credentials.
 */
export async function getStoreCredentials(
  store?: SupportedStoreType
): Promise<{ data: StoreCredential | StoreCredential[] | null; error: string | null }> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return { data: null, error: "Unauthorized" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    const where = store
      ? { userId: user.id, store }
      : { userId: user.id };

    const credentials = await prisma.storeCredential.findMany({
      where,
      select: {
        id: true,
        store: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        // Note: encryptedPassword, iv, authTag are NOT selected
      },
    });

    const result: StoreCredential[] = credentials.map((c) => ({
      id: c.id,
      store: c.store as SupportedStoreType,
      email: c.email,
      hasPassword: true,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    // If filtering by store, return single result or null
    if (store) {
      return { data: result[0] || null, error: null };
    }

    return { data: result, error: null };
  } catch (error) {
    console.error("[Store Credentials] Error fetching credentials:", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to fetch credentials",
    };
  }
}

/**
 * Delete store credentials
 */
export async function deleteStoreCredentials(
  store: SupportedStoreType
): Promise<{ data: { success: boolean } | null; error: string | null }> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return { data: null, error: "Unauthorized" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    await prisma.storeCredential.deleteMany({
      where: {
        userId: user.id,
        store,
      },
    });

    console.log(
      `[Store Credentials] Deleted credentials for ${store} (user: ${user.id})`
    );

    revalidatePath("/settings");

    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("[Store Credentials] Error deleting credentials:", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to delete credentials",
    };
  }
}
