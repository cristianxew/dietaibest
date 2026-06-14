import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { assertCanImportRecipe } from "@/lib/entitlements";
import { toEntitlementError } from "@/lib/entitlement-error";
import { extractRecipe, selectIngestStrategy } from "@/lib/ingest/extract-recipe";
import { SupadataError } from "@/lib/supadata";
import { GemmaExtractionError } from "@/lib/chat/llm-gemma";
import type { Locale } from "@/lib/chat/context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Recipe import from a URL — modal entry point. Mirrors the chat tool
// `importRecipeFromUrl`: extraction runs through Supadata (+ Gemma for web
// pages) via the shared `extractRecipe` core. Synchronous JSON response (no
// SSE / taskId) — the modal prefills the recipe form with the result and the
// user saves through the normal create flow, which re-checks entitlement and
// tags the recipe as imported.

const VALID_LOCALES: ReadonlySet<string> = new Set(["en", "es", "pl"]);

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return jsonError(401, "unauthorized", "Sign-in required");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, plan: true, subscriptionStatus: true },
  });
  if (!user) {
    return jsonError(404, "user-not-found", "User not found");
  }

  try {
    await assertCanImportRecipe(user);
  } catch (err) {
    const payload = toEntitlementError(err);
    if (payload) {
      return new Response(JSON.stringify({ error: payload }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw err;
  }

  let body: { url?: unknown; locale?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "invalid-body", "Expected JSON body");
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    return jsonError(400, "invalid-url", "A recipe URL is required");
  }
  const locale: Locale = VALID_LOCALES.has(String(body.locale))
    ? (body.locale as Locale)
    : "en";

  let strategy: ReturnType<typeof selectIngestStrategy>;
  try {
    strategy = selectIngestStrategy(url);
  } catch {
    return jsonError(400, "invalid-url", "That does not look like a valid URL");
  }

  try {
    const recipe = await extractRecipe(strategy, url, locale);

    if (!recipe.title || recipe.title.length < 3 || recipe.ingredients.length === 0) {
      return jsonError(422, "no-recipe", "No recipe could be extracted from that link");
    }

    return new Response(JSON.stringify({ recipe }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof GemmaExtractionError) {
      console.warn("[recipes/import/url] extraction failed", err.reason, err.message);
      return jsonError(422, "no-recipe", "No recipe could be extracted from that link");
    }
    if (err instanceof SupadataError) {
      console.warn("[recipes/import/url] supadata error", err.code, err.status, err.message);
      if (err.status === 429) {
        return jsonError(429, "rate-limited", "The importer is busy. Try again shortly");
      }
      if (err.status === 404) {
        return jsonError(404, "not-found", "We couldn't reach that page");
      }
      return jsonError(502, "ingest-failed", "Could not read that page");
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[recipes/import/url] unexpected error", message);
    return jsonError(500, "generic", "Something went wrong importing that recipe");
  }
}
