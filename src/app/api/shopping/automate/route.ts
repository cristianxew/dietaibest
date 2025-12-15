import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import {
  getBrowserUseClient,
  SupportedStore,
  SUPPORTED_STORES,
} from "@/lib/browser-use";

// ============================================================================
// Request Validation Schema
// ============================================================================

const shoppingRequestSchema = z.object({
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

// ============================================================================
// POST Handler - Start Shopping Automation
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request
    const body = await request.json();
    const validation = shoppingRequestSchema.safeParse(body);

    if (!validation.success) {
      console.error(
        "[Shopping API] Validation error:",
        validation.error.errors
      );
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { store, items, preferences, credentials } = validation.data;

    // Validate store exists
    if (!SUPPORTED_STORES[store as SupportedStore]) {
      return NextResponse.json(
        { error: `Store "${store}" is not supported` },
        { status: 400 }
      );
    }

    console.log(
      `[Shopping API] Starting automation for ${store} with ${items.length} items`
    );

    try {
      const browserUseClient = getBrowserUseClient();
      const { taskId, sessionId } =
        await browserUseClient.startShoppingAutomation({
          store: store as SupportedStore,
          items,
          preferences,
          credentials,
        });

      console.log(`[Shopping API] Task started: ${taskId}`);

      return NextResponse.json({
        taskId,
        sessionId,
        store,
        itemCount: items.length,
        message: "Shopping automation started",
      });
    } catch (error) {
      console.error("[Shopping API] Browser Use error:", error);
      return NextResponse.json(
        {
          error: "Failed to start shopping automation",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Shopping API] Route error:", error);
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
