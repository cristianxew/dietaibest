# Recipe URL Import — AI Extraction + Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the brittle regex web-recipe parser in `importRecipeFromUrl` with AI extraction over Supadata's scraped markdown, and add a rich read-only preview card that the user confirms before the recipe is saved.

**Architecture:** Extraction moves into the tool's `requiresConfirmation` hook so it runs once; on success it returns a `ConfirmDescriptor` whose payload carries the extracted recipe → the runtime emits `confirm.request` and pauses → the chat UI renders a `RecipePreviewCard` → on Save, `execute` persists the recipe from the payload with no re-extraction. A small `try/catch` is added around the runtime confirmation gate so the preview phase can fail cleanly via a typed `ToolFailure`.

**Tech Stack:** Next.js, TypeScript, Zod, Vitest, `@google/genai` (Gemini via Vertex), Supadata HTTP API, next-intl. **Package manager: `bun` (never npm).**

**Reference spec:** `docs/superpowers/specs/2026-05-31-recipe-url-import-ai-extraction-design.md`

**Conventions for every task:**
- Run a single test file with: `bunx vitest run <path>`
- Typecheck with: `bunx tsc --noEmit`
- Conventional commits, no AI attribution.

---

### Task 1: Move the Gemma provider factory into `llm-gemma.ts` (shared singleton)

Today `getProvider()` / `setGemmaProviderForTest()` live inside the image tool. Both the image and URL tools must share one provider singleton, so it moves to `llm-gemma.ts`.

**Files:**
- Modify: `src/lib/chat/llm-gemma.ts` (add factory at end of file)
- Modify: `src/lib/chat/tools/importRecipeFromImage.ts:63-76` (delete local factory, import shared one, re-export the test hook)
- Test: existing `tests/unit/chat/import-recipe-image-tool.test.ts` must still pass unchanged.

- [ ] **Step 1: Add the shared factory to `llm-gemma.ts`**

Append to the end of `src/lib/chat/llm-gemma.ts` (after the `GemmaProvider` class closes):

```typescript
// ---------------------------------------------------------------------------
// Shared lazy singleton. Lives here (not in a tool) so importRecipeFromImage
// and importRecipeFromUrl share one provider, and tests inject one fake via
// setGemmaProviderForTest.
// ---------------------------------------------------------------------------
let providerOverride: GemmaProvider | null = null;
let providerSingleton: GemmaProvider | null = null;

export function setGemmaProviderForTest(p: GemmaProvider | null): void {
  providerOverride = p;
}

export function getGemmaProvider(): GemmaProvider {
  if (providerOverride) return providerOverride;
  if (!providerSingleton) providerSingleton = new GemmaProvider();
  return providerSingleton;
}
```

- [ ] **Step 2: Update `importRecipeFromImage.ts` to use the shared factory**

In `src/lib/chat/tools/importRecipeFromImage.ts`, change the import on line 5 from:

```typescript
import { GemmaExtractionError, GemmaProvider } from "@/lib/chat/llm-gemma";
```

to:

```typescript
import {
  GemmaExtractionError,
  getGemmaProvider,
  setGemmaProviderForTest,
} from "@/lib/chat/llm-gemma";
```

Delete the local factory block (lines 63-76: the `providerOverride` / `providerSingleton` vars, `setGemmaProviderForTest`, and `getProvider`). Replace it with a single re-export so existing test imports keep working:

```typescript
// Re-exported for tests that import the hook from this module's path.
export { setGemmaProviderForTest };
```

Then replace the call site on line 237 from `getProvider()` to `getGemmaProvider()`:

```typescript
      imported = await getGemmaProvider().extractRecipe({
        imageBytes: bytes,
        mimeType: event.mimeType,
        locale: ctx.locale,
      });
```

- [ ] **Step 3: Run the image tool test to verify no regression**

Run: `bunx vitest run tests/unit/chat/import-recipe-image-tool.test.ts`
Expected: PASS (same tests as before — the test hook still resolves through the re-export).

- [ ] **Step 4: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chat/llm-gemma.ts src/lib/chat/tools/importRecipeFromImage.ts
git commit -m "refactor(chat): move Gemma provider factory into llm-gemma for sharing"
```

---

### Task 2: Add `extractRecipeFromText` to `GemmaProvider`

Mirror `extractRecipe` (image) for scraped-markdown input. Factor the shared parse/validate/error logic into one private helper.

**Files:**
- Modify: `src/lib/chat/llm-gemma.ts`
- Test: `tests/unit/chat/llm-gemma-text.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/chat/llm-gemma-text.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { GoogleGenAI } from "@google/genai";

import { GemmaProvider, GemmaExtractionError } from "@/lib/chat/llm-gemma";

/** Build a provider whose Gemini client returns a canned JSON string. */
function providerReturning(json: unknown, capture?: (text: string) => void) {
  const clientOverride: Pick<GoogleGenAI, "models"> = {
    // @ts-expect-error — only `generateContent` is used by the provider.
    models: {
      async generateContent(params: {
        contents: Array<{ parts: Array<{ text?: string }> }>;
      }) {
        capture?.(params.contents[0]?.parts[0]?.text ?? "");
        return { text: JSON.stringify(json) };
      },
    },
  };
  return new GemmaProvider({ clientOverride });
}

describe("GemmaProvider.extractRecipeFromText", () => {
  it("extracts a structured recipe from web-page markdown", async () => {
    const provider = providerReturning({
      title: "Chocolate Chip Cookies",
      ingredients: [{ name: "flour", amount: 2, unit: "cup" }],
      instructions: ["Mix", "Bake"],
    });

    const recipe = await provider.extractRecipeFromText({
      content: "# Chocolate Chip Cookies\n\nIngredients: 2 cups flour...",
      locale: "en",
      sourceUrl: "https://recipes.example.com/cookies",
    });

    expect(recipe.title).toBe("Chocolate Chip Cookies");
    expect(recipe.ingredients).toHaveLength(1);
    expect(recipe.sourceUrl).toBe("https://recipes.example.com/cookies");
  });

  it("throws no-ingredients when the page has no recipe", async () => {
    const provider = providerReturning({
      title: "",
      ingredients: [],
      instructions: [],
    });

    await expect(
      provider.extractRecipeFromText({ content: "Category index page", locale: "en" })
    ).rejects.toMatchObject({ reason: "no-ingredients" });
    await expect(
      provider.extractRecipeFromText({ content: "Category index page", locale: "en" })
    ).rejects.toBeInstanceOf(GemmaExtractionError);
  });

  it("truncates oversized markdown to the character cap before sending", async () => {
    let sentText = "";
    const provider = providerReturning(
      {
        title: "Soup",
        ingredients: [{ name: "water", amount: 1, unit: "l" }],
        instructions: ["Boil"],
      },
      (text) => {
        sentText = text;
      }
    );

    const huge = "x".repeat(50_000);
    await provider.extractRecipeFromText({ content: huge, locale: "en" });

    // Prompt prefix + at most 24k content chars — far below the 50k input.
    expect(sentText.length).toBeLessThan(24_500);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx vitest run tests/unit/chat/llm-gemma-text.test.ts`
Expected: FAIL with "extractRecipeFromText is not a function".

- [ ] **Step 3: Implement the method + shared helper**

In `src/lib/chat/llm-gemma.ts`:

Add the text args interface and prompt constants after `ExtractRecipeArgs` (line 54):

```typescript
export interface ExtractRecipeFromTextArgs {
  content: string;
  locale?: "en" | "es" | "pl";
  sourceUrl?: string;
}

/** Hard cap on markdown sent to the model — recipes fit comfortably; this
 * bounds token cost on blog pages with huge preamble. */
const MAX_CONTENT_CHARS = 24_000;

const PROMPT_BASE_TEXT = `You are a kitchen assistant extracting a structured recipe from the scraped Markdown of a web page. The Markdown may include navigation, ads, comments, related-recipe lists, and other noise around the recipe.

Output a JSON object that conforms to the provided schema. Be precise:

- title: the dish's name. Trim quotation marks and ellipses.
- ingredients: each line as { name, amount, unit }. Amount is a number (use 0 only if quantity is literally absent). Unit is the singular form ("cup", "tbsp", "g", "ml"). Keep ingredient names in the source language.
- instructions: each step as one string in the source language. Skip section headers ("Preparation", "For the sauce").
- servings: integer >= 1, only if explicitly stated.
- prepTime / cookTime: integer minutes, only if explicitly stated.
- description, cuisine, difficulty, tags, nutrition fields: omit entirely if not present.

Do NOT invent ingredients or quantities. If the page does not contain a recipe (e.g. a category listing, a blog index, a product page), return an empty ingredients array — the calling tool surfaces "no-ingredients" to the user.

If multiple recipes appear, extract only the main one the page is about.`;

const LOCALE_HINT_TEXT: Record<NonNullable<ExtractRecipeFromTextArgs["locale"]>, string> = {
  en: "If the page is in another language, keep ingredient/instruction text in that language — the user picked an English UI but the recipe stays in its source language.",
  es: "Si la página está en otro idioma, mantené los ingredientes e instrucciones en ese idioma. El usuario eligió español pero la receta queda en su idioma fuente.",
  pl: "Jeśli strona jest w innym języku, zachowaj składniki i instrukcje w tym języku. Użytkownik wybrał polski interfejs, ale przepis pozostaje w języku źródłowym.",
};
```

Inside the `GemmaProvider` class, refactor: replace the body of `extractRecipe` (lines 102-170) so the shared parse/validate/error logic lives in a private `runExtraction`, and add `extractRecipeFromText`:

```typescript
  async extractRecipe(args: ExtractRecipeArgs): Promise<ImportedRecipeData> {
    const locale = args.locale ?? "en";
    const systemInstruction = `${PROMPT_BASE}\n\n${LOCALE_HINT[locale]}`;
    const base64 = Buffer.from(args.imageBytes).toString("base64");

    return this.runExtraction({
      model: this.modelId,
      contents: [
        {
          role: "user",
          parts: [
            { text: "Extract the recipe from this image." },
            { inlineData: { data: base64, mimeType: args.mimeType } },
          ],
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: zodToJsonSchema(importedRecipeSchema),
      },
    });
  }

  async extractRecipeFromText(
    args: ExtractRecipeFromTextArgs
  ): Promise<ImportedRecipeData> {
    const locale = args.locale ?? "en";
    const systemInstruction = `${PROMPT_BASE_TEXT}\n\n${LOCALE_HINT_TEXT[locale]}`;
    const content = args.content.slice(0, MAX_CONTENT_CHARS);

    const recipe = await this.runExtraction({
      model: this.modelId,
      contents: [
        {
          role: "user",
          parts: [{ text: `Extract the recipe from this web page content:\n\n${content}` }],
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: zodToJsonSchema(importedRecipeSchema),
      },
    });

    if (args.sourceUrl) recipe.sourceUrl = args.sourceUrl;
    return recipe;
  }

  /** Shared transport + parse + validation + error mapping for both extractors. */
  private async runExtraction(
    params: GenerateContentParameters
  ): Promise<ImportedRecipeData> {
    let recipe: ImportedRecipeData;
    try {
      const response = await this.client.models.generateContent(params);
      const text = response.text;
      if (!text) {
        throw new GemmaExtractionError("transient", "Gemma returned an empty response");
      }
      const parsed: unknown = JSON.parse(text);
      recipe = importedRecipeSchema.parse(parsed);
    } catch (err) {
      if (err instanceof GemmaExtractionError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      if (/schema|validation|parse|ZodError/i.test(message)) {
        throw new GemmaExtractionError(
          "schema-mismatch",
          `Gemma returned data that did not match the recipe schema: ${message}`,
          { cause: err }
        );
      }
      throw new GemmaExtractionError(
        "transient",
        `Gemma extraction failed: ${message}`,
        { cause: err }
      );
    }

    // Schema accepts empty ingredients so the caller can surface "no-ingredients".
    if (recipe.ingredients.length === 0) {
      const reason =
        recipe.title && recipe.title.trim().length > 0 ? "low-quality" : "no-ingredients";
      throw new GemmaExtractionError(
        reason,
        `Gemma extracted no usable ingredients (title=${JSON.stringify(recipe.title)})`
      );
    }

    return recipe;
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bunx vitest run tests/unit/chat/llm-gemma-text.test.ts`
Expected: PASS (3 tests).

Also re-run the image test to confirm the refactor kept it green:
Run: `bunx vitest run tests/unit/chat/generate-recipe-image-tool.test.ts tests/unit/chat/import-recipe-image-tool.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chat/llm-gemma.ts tests/unit/chat/llm-gemma-text.test.ts
git commit -m "feat(chat): add extractRecipeFromText to GemmaProvider"
```

---

### Task 3: Add `ToolFailure` + make the runtime confirmation gate failable

The confirmation gate (`runtime.ts:295-308`) does not catch errors from `requiresConfirmation`. The preview phase needs to fail cleanly (no recipe / scrape error) instead of erroring the whole turn.

**Files:**
- Modify: `src/lib/chat/tools/types.ts` (add `ToolFailure`)
- Modify: `src/lib/chat/runtime.ts:295-308` (wrap gate in try/catch)
- Test: `tests/unit/chat/runtime.test.ts` (add a describe block)

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/chat/runtime.test.ts` — first extend the import on line 6 and add a tool near the other test tools (after `confirmTool`, line 47):

```typescript
import type { AnyTool } from "@/lib/chat/tools/types";
import { ToolFailure } from "@/lib/chat/tools/types";
```

```typescript
const failingConfirmTool: AnyTool = {
  name: "previewThing",
  description: "preview that can fail",
  inputSchema: z.object({ id: z.string(), confirmed: z.boolean().optional() }),
  statusKey: "import.fetching",
  async requiresConfirmation(input) {
    if ((input as { confirmed?: boolean }).confirmed) return null;
    throw new ToolFailure("notFound", "ingest-failed: no-ingredients");
  },
  async execute() {
    return { ok: true, data: { saved: true } };
  },
};
```

Add this describe block at the end of the file:

```typescript
describe("AgentRuntime — confirmation gate failure", () => {
  it("maps a ToolFailure thrown in requiresConfirmation to tool.failed", async () => {
    const store = new FakeStore();
    const provider = new ScriptedProvider([
      [
        {
          kind: "tool-call",
          callId: "p-1",
          toolName: "previewThing",
          input: { id: "x1" },
        },
      ],
      [{ kind: "finish" }],
    ]);

    const runtime = new AgentRuntime({
      llm: provider,
      store,
      tools: [failingConfirmTool],
    });
    const events = await collect(
      runtime.run({ ctx: makeCtx(), userMessage: "preview x1" })
    );

    const failed = events.find((e) => e.type === "tool.failed");
    expect(failed).toBeDefined();
    if (failed && failed.type === "tool.failed") {
      expect(failed.reason).toBe("notFound");
    }
    expect(events.find((e) => e.type === "confirm.request")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx vitest run tests/unit/chat/runtime.test.ts`
Expected: FAIL — `ToolFailure` is not exported (compile error), or the run throws instead of emitting `tool.failed`.

- [ ] **Step 3: Add `ToolFailure` to `types.ts`**

Append to `src/lib/chat/tools/types.ts`:

```typescript
/**
 * Thrown from a tool's `requiresConfirmation` to fail the preview phase cleanly.
 * The runtime catches it at the confirmation gate and emits `tool.failed` with
 * this reason — without this, a throw there would error the whole turn.
 */
export class ToolFailure extends Error {
  readonly reason: "generic" | "quota" | "notFound" | "unauthorized";
  constructor(
    reason: ToolFailure["reason"],
    message: string
  ) {
    super(message);
    this.name = "ToolFailure";
    this.reason = reason;
  }
}
```

- [ ] **Step 4: Wrap the confirmation gate in `runtime.ts`**

At the top of `src/lib/chat/runtime.ts`, add `ToolFailure` to the existing import from `./tools/types` (find the line importing `AnyTool` / tool types and add `ToolFailure`). If tool types are imported type-only, add a separate value import:

```typescript
import { ToolFailure } from "./tools/types";
```

Replace the confirmation gate (lines 295-308) with:

```typescript
        // Confirmation gate. If the tool requires confirmation, emit a
        // confirm.request and STOP. The client re-calls run() with
        // pendingResolve once the user has answered. A ToolFailure thrown
        // during this phase (e.g. no recipe extracted) fails cleanly.
        if (tool.requiresConfirmation) {
          let descriptor;
          try {
            descriptor = await tool.requiresConfirmation(call.input, ctx);
          } catch (err) {
            if (err instanceof ToolFailure) {
              yield {
                type: "tool.failed",
                toolName: tool.name,
                callId: call.callId,
                reason: err.reason,
              };
              continue;
            }
            throw err;
          }
          if (descriptor) {
            yield {
              type: "confirm.request",
              callId: call.callId,
              toolName: tool.name,
              message: descriptor.message,
              payload: descriptor.payload,
            };
            await this.store.append(ctx.conversationId, pendingPersist);
            return;
          }
        }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bunx vitest run tests/unit/chat/runtime.test.ts`
Expected: PASS (all existing tests + the new failure test).

- [ ] **Step 6: Commit**

```bash
git add src/lib/chat/tools/types.ts src/lib/chat/runtime.ts tests/unit/chat/runtime.test.ts
git commit -m "feat(chat): fail the confirmation gate cleanly via ToolFailure"
```

---

### Task 4: Rewire `importRecipeFromUrl` — extract in `requiresConfirmation`, persist in `execute`

**Files:**
- Modify: `src/lib/chat/tools/importRecipeFromUrl.ts`
- Test: `tests/unit/chat/import-recipe-tool.test.ts` (rewrite to drive the new two-phase flow)

- [ ] **Step 1: Rewrite the tool test for the two-phase flow**

Replace the whole body of `tests/unit/chat/import-recipe-tool.test.ts` with the
following. **Use static imports and do NOT call `vi.resetModules()`** — this
mirrors `import-recipe-image-tool.test.ts`. Dynamic imports + `resetModules`
would put the tool's `ToolFailure` / `GemmaExtractionError` classes in a
different module instance than the test's, breaking `instanceof`, and would also
sever the `setGemmaProviderForTest` override from the tool's provider singleton.

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import type { AgentContext } from "@/lib/chat/context";
import type { Entitlements } from "@/lib/entitlements";
import { ToolFailure } from "@/lib/chat/tools/types";
import {
  GemmaProvider,
  GemmaExtractionError,
  setGemmaProviderForTest,
} from "@/lib/chat/llm-gemma";
import { persistRecipe } from "@/actions/recipe";
import { importRecipeFromUrl } from "@/lib/chat/tools/importRecipeFromUrl";

vi.mock("@/actions/recipe", () => ({
  persistRecipe: vi.fn(),
}));

const PRO: Entitlements = {
  isPro: true,
  limits: {
    savedRecipes: Number.POSITIVE_INFINITY,
    recipesCreatedPerMonth: Number.POSITIVE_INFINITY,
    importsPerMonth: Number.POSITIVE_INFINITY,
    mealPlanTemplates: Number.POSITIVE_INFINITY,
    mealPlanDurationDays: Number.POSITIVE_INFINITY,
    edamamAnalysesPerMonth: Number.POSITIVE_INFINITY,
  },
  features: {
    aiMealPlan: true,
    shoppingAutomation: true,
    recipeImport: true,
    aiChat: true,
  },
};

function makeCtx(): AgentContext {
  return { userId: "u1", locale: "en", conversationId: "c1", entitlements: PRO };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** A GemmaProvider whose text extractor is fully scripted. */
function fakeTextProvider(
  impl: (args: { content: string }) => Promise<unknown>
): GemmaProvider {
  const p = Object.create(GemmaProvider.prototype) as GemmaProvider;
  // @ts-expect-error — override the only method the URL tool calls.
  p.extractRecipeFromText = impl;
  return p;
}

describe("importRecipeFromUrl — requiresConfirmation (preview)", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.SUPADATA_API_KEY = "test-key";
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setGemmaProviderForTest(null);
    vi.clearAllMocks();
  });

  it("scrapes a web URL, extracts with AI, and returns a preview descriptor", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        url: "https://recipes.example.com/cookies",
        content: "# Cookies\n\nlots of markdown...",
        name: "Chocolate Chip Cookies",
        description: "A classic.",
      })
    );
    setGemmaProviderForTest(
      fakeTextProvider(async () => ({
        title: "Chocolate Chip Cookies",
        ingredients: [
          { name: "flour", amount: 2, unit: "cup" },
          { name: "sugar", amount: 1, unit: "cup" },
        ],
        instructions: ["Mix", "Bake"],
      }))
    );

    const descriptor = await importRecipeFromUrl.requiresConfirmation!(
      { url: "https://recipes.example.com/cookies" },
      makeCtx()
    );

    expect(descriptor).not.toBeNull();
    const payload = descriptor!.payload as {
      confirmed: boolean;
      recipe: { title: string; ingredients: unknown[] };
    };
    expect(payload.confirmed).toBe(true);
    expect(payload.recipe.title).toBe("Chocolate Chip Cookies");
    expect(payload.recipe.ingredients).toHaveLength(2);

    const [calledUrl] = fetchSpy.mock.calls[0]!;
    expect(String(calledUrl)).toContain("/web/scrape");
  });

  it("returns null (skip preview) when already confirmed", async () => {
    const descriptor = await importRecipeFromUrl.requiresConfirmation!(
      { url: "https://recipes.example.com/cookies", confirmed: true },
      makeCtx()
    );

    expect(descriptor).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("throws ToolFailure(notFound) when the page has no recipe", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ url: "https://x.com/p", content: "category index", name: "Index" })
    );
    setGemmaProviderForTest(
      fakeTextProvider(async () => {
        throw new GemmaExtractionError("no-ingredients", "no recipe");
      })
    );

    await expect(
      importRecipeFromUrl.requiresConfirmation!(
        { url: "https://recipes.example.com/index" },
        makeCtx()
      )
    ).rejects.toBeInstanceOf(ToolFailure);
  });

  it("throws ToolFailure when Supadata scrape responds 5xx", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ message: "boom" }, 503));

    await expect(
      importRecipeFromUrl.requiresConfirmation!(
        { url: "https://recipes.example.com/down" },
        makeCtx()
      )
    ).rejects.toMatchObject({ reason: "generic" });
  });
});

describe("importRecipeFromUrl — execute (persist confirmed recipe)", () => {
  beforeEach(() => {
    process.env.SUPADATA_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("persists the recipe from the payload without re-extracting", async () => {
    vi.mocked(persistRecipe).mockResolvedValueOnce({
      data: { id: "r-web", title: "Chocolate Chip Cookies" } as never,
      error: null,
    });

    const result = await importRecipeFromUrl.execute(
      {
        url: "https://recipes.example.com/cookies",
        confirmed: true,
        recipe: {
          title: "Chocolate Chip Cookies",
          ingredients: [{ name: "flour", amount: 2, unit: "cup" }],
          instructions: ["Mix", "Bake"],
          sourceUrl: "https://recipes.example.com/cookies",
        },
      },
      makeCtx()
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.link?.href).toBe("/recipes/r-web");
    }
    expect(vi.mocked(persistRecipe)).toHaveBeenCalledTimes(1);
    const [, options] = vi.mocked(persistRecipe).mock.calls[0]!;
    expect(options).toMatchObject({ source: "url", locale: "en" });
  });

  it("maps PRO_ONLY persist errors to unauthorized", async () => {
    vi.mocked(persistRecipe).mockResolvedValueOnce({
      data: null,
      error: { code: "PRO_ONLY", message: "Pro only" } as never,
    });

    const result = await importRecipeFromUrl.execute(
      {
        url: "https://recipes.example.com/cookies",
        confirmed: true,
        recipe: {
          title: "Risotto",
          ingredients: [{ name: "rice", amount: 200, unit: "g" }],
          instructions: ["Cook"],
        },
      },
      makeCtx()
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unauthorized");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx vitest run tests/unit/chat/import-recipe-tool.test.ts`
Expected: FAIL — `requiresConfirmation` is undefined and `execute` does not read `input.recipe`.

- [ ] **Step 3: Rewrite `importRecipeFromUrl.ts`**

Replace the full contents of `src/lib/chat/tools/importRecipeFromUrl.ts` with:

```typescript
import { z } from "zod";

import { persistRecipe } from "@/actions/recipe";
import {
  selectIngestStrategy,
  type IngestStrategy,
} from "@/lib/chat/ingestion/select-strategy";
import { getSupadataClient, SupadataError } from "@/lib/supadata";
import {
  GemmaExtractionError,
  getGemmaProvider,
} from "@/lib/chat/llm-gemma";
import { importedRecipeSchema } from "@/lib/ingest/imported-recipe-schema";
import type { ImportedRecipe } from "@/types/recipe";
import type { ScrapeResult } from "@/lib/supadata";
import type { AgentContext } from "../context";
import { ToolFailure, type ConfirmDescriptor, type Tool } from "./types";

/**
 * Tool: importRecipeFromUrl.
 *
 * Two-phase:
 *  - requiresConfirmation(): routes the URL through Supadata, extracts a
 *    structured recipe (web → /web/scrape + Gemma; video → /extract), and
 *    returns a preview descriptor whose payload carries the recipe. Any failure
 *    throws ToolFailure → the runtime emits tool.failed.
 *  - execute(): runs only after the user confirms; persists input.recipe with
 *    NO re-extraction.
 */

// Recipe JSON Schema sent to Supadata's /extract endpoint (video path only).
const RECIPE_EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    prepTime: { type: "number" },
    cookTime: { type: "number" },
    servings: { type: "number" },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          amount: { type: "number" },
          unit: { type: "string" },
        },
        required: ["name", "amount", "unit"],
      },
    },
    instructions: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    imageUrl: { type: "string" },
  },
  required: ["title", "ingredients", "instructions"],
} as const;

const inputSchema = z.object({
  url: z.string().url(),
  hint: z.string().max(200).optional(),
  confirmed: z.boolean().optional(),
  recipe: importedRecipeSchema.optional(),
});

type Input = z.infer<typeof inputSchema>;

export type ImportFailureReason =
  | "ingest-failed"
  | "no-ingredients"
  | "no-recipe-data"
  | "persist-failed"
  | "invalid-url";

interface ImportFailureLog {
  host: string | null;
  strategy: IngestStrategy | "unknown";
  errorReason: ImportFailureReason;
  errorCode?: string;
  status?: number;
  createdAt: string;
}

function logImportFailure(failure: ImportFailureLog): void {
  console.warn("[importRecipeFromUrl] ImportFailure", failure);
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function normaliseExtracted(
  data: Partial<ImportedRecipe> | null | undefined,
  sourceUrl: string
): ImportedRecipe {
  return {
    title: (data?.title ?? "").trim(),
    description: data?.description?.trim() || undefined,
    prepTime: data?.prepTime,
    cookTime: data?.cookTime,
    servings: data?.servings,
    ingredients: Array.isArray(data?.ingredients) ? data!.ingredients! : [],
    instructions: Array.isArray(data?.instructions) ? data!.instructions! : [],
    tags: Array.isArray(data?.tags) ? data!.tags! : [],
    imageUrl: data?.imageUrl,
    sourceUrl,
    extractedAt: new Date().toISOString(),
  };
}

/** Map a Gemma-extracted recipe + scrape metadata into the canonical shape. */
function mapScrapeToImported(
  data: {
    title: string;
    description?: string;
    prepTime?: number;
    cookTime?: number;
    servings?: number;
    ingredients: ImportedRecipe["ingredients"];
    instructions: string[];
    tags?: string[];
    imageUrl?: string;
  },
  scrape: ScrapeResult,
  sourceUrl: string
): ImportedRecipe {
  return {
    title: (data.title || scrape.name || "").trim(),
    description: data.description?.trim() || scrape.description?.trim() || undefined,
    prepTime: data.prepTime,
    cookTime: data.cookTime,
    servings: data.servings,
    ingredients: data.ingredients,
    instructions: data.instructions,
    tags: data.tags ?? [],
    imageUrl: data.imageUrl || scrape.ogUrl || undefined,
    sourceUrl,
    extractedAt: new Date().toISOString(),
  };
}

async function extractRecipe(
  strategy: IngestStrategy,
  url: string,
  ctx: AgentContext
): Promise<ImportedRecipe> {
  const client = getSupadataClient();
  if (strategy === "supadata-video") {
    const data = await client.extractVideo<Partial<ImportedRecipe>>(
      url,
      RECIPE_EXTRACT_SCHEMA
    );
    return normaliseExtracted(data, url);
  }
  const scrape = await client.scrapeWeb(url);
  const extracted = await getGemmaProvider().extractRecipeFromText({
    content: scrape.content ?? "",
    locale: ctx.locale,
    sourceUrl: url,
  });
  return mapScrapeToImported(extracted, scrape, url);
}

export const importRecipeFromUrl: Tool<
  typeof inputSchema,
  { id: string; title: string }
> = {
  name: "importRecipeFromUrl",
  description:
    "Import a recipe from a URL (YouTube, TikTok, Instagram, Facebook, X, or a recipe website) and save it to the user's library. The user is shown a preview to confirm before it is saved. Returns a link to the saved recipe.",
  inputSchema,
  statusKey: "import.fetching",
  requiresFeature: "aiChat",

  async requiresConfirmation(
    input: Input,
    ctx: AgentContext
  ): Promise<ConfirmDescriptor | null> {
    // Resume path: the recipe was already previewed + confirmed.
    if (input.confirmed) return null;

    const { url } = input;
    const host = safeHost(url);

    let strategy: IngestStrategy;
    try {
      strategy = selectIngestStrategy(url);
    } catch {
      logImportFailure({
        host,
        strategy: "unknown",
        errorReason: "invalid-url",
        createdAt: new Date().toISOString(),
      });
      throw new ToolFailure("generic", "ingest-failed: invalid-url");
    }

    let imported: ImportedRecipe;
    try {
      imported = await extractRecipe(strategy, url, ctx);
    } catch (error) {
      if (error instanceof GemmaExtractionError) {
        logImportFailure({
          host,
          strategy,
          errorReason: "no-ingredients",
          errorCode: error.reason,
          createdAt: new Date().toISOString(),
        });
        throw new ToolFailure("notFound", `ingest-failed: ${error.reason}`);
      }
      const errorCode = error instanceof SupadataError ? error.code : "UNKNOWN";
      const status = error instanceof SupadataError ? error.status : undefined;
      logImportFailure({
        host,
        strategy,
        errorReason: "ingest-failed",
        errorCode,
        status,
        createdAt: new Date().toISOString(),
      });
      throw new ToolFailure(
        status === 404 ? "notFound" : "generic",
        `ingest-failed: ${errorCode}`
      );
    }

    if (
      !imported.title ||
      imported.title.length < 3 ||
      imported.ingredients.length === 0
    ) {
      logImportFailure({
        host,
        strategy,
        errorReason: "no-ingredients",
        createdAt: new Date().toISOString(),
      });
      throw new ToolFailure("notFound", "ingest-failed: no-ingredients");
    }

    return {
      message: imported.title,
      payload: { url, hint: input.hint, confirmed: true, recipe: imported },
    };
  },

  async execute(input: Input, ctx) {
    const { url } = input;
    const host = safeHost(url);
    const imported = input.recipe;

    if (!imported) {
      // Defensive: execute runs only after requiresConfirmation supplies a recipe.
      logImportFailure({
        host,
        strategy: "unknown",
        errorReason: "no-recipe-data",
        createdAt: new Date().toISOString(),
      });
      return {
        ok: false,
        reason: "generic",
        message: "ingest-failed: no-recipe-data",
      };
    }

    const strategy: IngestStrategy | "unknown" = (() => {
      try {
        return selectIngestStrategy(url);
      } catch {
        return "unknown";
      }
    })();

    const persisted = await persistRecipe(
      {
        title: imported.title,
        description: imported.description,
        prepTime: imported.prepTime,
        cookTime: imported.cookTime,
        servings: imported.servings ?? 2,
        ingredients: imported.ingredients,
        instructions:
          imported.instructions.length > 0
            ? imported.instructions
            : ["Refer to the source for preparation steps."],
        tags: imported.tags ?? [],
        categoryIds: [],
        isPublic: false,
        sourceUrl: imported.sourceUrl ?? url,
        imageUrl: imported.imageUrl,
      },
      { source: "url", sourceUrl: url, locale: ctx.locale }
    );

    if (persisted.error || !persisted.data) {
      const code =
        persisted.error &&
        typeof persisted.error === "object" &&
        "code" in persisted.error
          ? (persisted.error as { code: string }).code
          : "GENERIC";
      logImportFailure({
        host,
        strategy,
        errorReason: "persist-failed",
        errorCode: code,
        createdAt: new Date().toISOString(),
      });
      const reason: "unauthorized" | "quota" | "generic" =
        code === "PRO_ONLY"
          ? "unauthorized"
          : code === "QUOTA_EXCEEDED"
            ? "quota"
            : "generic";
      return {
        ok: false,
        reason,
        message:
          typeof persisted.error === "string"
            ? persisted.error
            : "Could not save the imported recipe",
      };
    }

    return {
      ok: true,
      data: { id: persisted.data.id, title: persisted.data.title },
      link: {
        type: "recipe",
        href: `/recipes/${persisted.data.id}`,
        label: persisted.data.title,
      },
    };
  },
};
```

> **Note on `Tool.requiresConfirmation` typing:** the interface in `types.ts`
> declares it returning `Promise<ConfirmDescriptor | null>`. Throwing inside it
> is allowed (it's an async function). No signature change needed.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bunx vitest run tests/unit/chat/import-recipe-tool.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors. (If `ScrapeResult` is not exported from `@/lib/supadata`, it is — see `supadata.ts:52`.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/chat/tools/importRecipeFromUrl.ts tests/unit/chat/import-recipe-tool.test.ts
git commit -m "feat(chat): AI-extract web recipes with preview-before-save in importRecipeFromUrl"
```

---

### Task 5: Delete the dead regex parser

`importRecipeFromUrl` no longer references `parseRecipeFromScrape`.

**Files:**
- Delete: `src/lib/chat/ingestion/markdown-recipe-parser.ts`
- Delete: `tests/unit/chat/markdown-recipe-parser.test.ts` (if present)

- [ ] **Step 1: Confirm there are no remaining references**

Run: `rg -n "markdown-recipe-parser|parseRecipeFromScrape" src tests`
Expected: no matches (if any appear outside the two files being deleted, stop and fix the reference first).

- [ ] **Step 2: Delete the files**

```bash
git rm src/lib/chat/ingestion/markdown-recipe-parser.ts
git rm tests/unit/chat/markdown-recipe-parser.test.ts 2>/dev/null || true
```

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(chat): remove dead regex markdown recipe parser"
```

---

### Task 6: `RecipePreviewCard` component + wire into `ChatMessage`

**Files:**
- Create: `src/components/chat/RecipePreviewCard.tsx`
- Modify: `src/components/chat/ChatMessage.tsx` (extend `MessageContent`, render the card)
- Test: `tests/unit/chat/recipe-preview-card.test.tsx` (create)

- [ ] **Step 1: Write the failing render test**

Create `tests/unit/chat/recipe-preview-card.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import { RecipePreviewCard } from "@/components/chat/RecipePreviewCard";

const messages = {
  chat: {
    preview: {
      save: "Save recipe",
      cancel: "Cancel",
      ingredients: "Ingredients",
      steps: "Steps",
      servings: "Servings",
      prep: "Prep",
      cook: "Cook",
      minutesShort: "min",
    },
  },
};

function renderCard(props: Parameters<typeof RecipePreviewCard>[0]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RecipePreviewCard {...props} />
    </NextIntlClientProvider>
  );
}

describe("RecipePreviewCard", () => {
  const recipe = {
    title: "Chocolate Chip Cookies",
    description: "A classic.",
    servings: 12,
    prepTime: 15,
    cookTime: 12,
    ingredients: [
      { name: "flour", amount: 2, unit: "cup" },
      { name: "sugar", amount: 1, unit: "cup" },
    ],
    instructions: ["Mix", "Bake"],
  };

  it("renders title, ingredients, and steps", () => {
    renderCard({ recipe, onSave: vi.fn(), onCancel: vi.fn() });
    expect(screen.getByText("Chocolate Chip Cookies")).toBeTruthy();
    expect(screen.getByText(/flour/)).toBeTruthy();
    expect(screen.getByText("Mix")).toBeTruthy();
  });

  it("fires onSave and onCancel", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    renderCard({ recipe, onSave, onCancel });
    fireEvent.click(screen.getByText("Save recipe"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx vitest run tests/unit/chat/recipe-preview-card.test.tsx`
Expected: FAIL — module `RecipePreviewCard` not found.

> `@testing-library/react` (^16.3.0) and the `jsdom` environment are already
> configured (`vitest.config.mts`), so this render test runs as-is.

- [ ] **Step 3: Implement `RecipePreviewCard.tsx`**

Create `src/components/chat/RecipePreviewCard.tsx`:

```tsx
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export interface RecipePreview {
  title: string;
  description?: string;
  imageUrl?: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  ingredients: { name: string; amount: number; unit: string }[];
  instructions: string[];
}

interface RecipePreviewCardProps {
  recipe: RecipePreview;
  onSave: () => void;
  onCancel: () => void;
}

function formatIngredient(i: { name: string; amount: number; unit: string }): string {
  const qty = i.amount > 0 ? `${i.amount} ${i.unit === "unit" ? "" : i.unit}`.trim() : "";
  return qty ? `${qty} ${i.name}` : i.name;
}

export function RecipePreviewCard({ recipe, onSave, onCancel }: RecipePreviewCardProps) {
  const t = useTranslations("chat.preview");

  const meta: string[] = [];
  if (recipe.servings) meta.push(`${t("servings")}: ${recipe.servings}`);
  if (recipe.prepTime) meta.push(`${t("prep")}: ${recipe.prepTime} ${t("minutesShort")}`);
  if (recipe.cookTime) meta.push(`${t("cook")}: ${recipe.cookTime} ${t("minutesShort")}`);

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-border bg-card">
      {recipe.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          className="h-40 w-full object-cover"
        />
      )}
      <div className="space-y-3 p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{recipe.title}</h3>
          {recipe.description && (
            <p className="mt-1 text-xs text-muted-foreground">{recipe.description}</p>
          )}
          {meta.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">{meta.join(" · ")}</p>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("ingredients")}
          </p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-foreground">
            {recipe.ingredients.map((ing, idx) => (
              <li key={idx}>{formatIngredient(ing)}</li>
            ))}
          </ul>
        </div>

        {recipe.instructions.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("steps")}
            </p>
            <ol className="list-decimal space-y-0.5 pl-4 text-xs text-foreground">
              {recipe.instructions.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={onSave}
            className={cn(
              "rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground",
              "transition-opacity duration-150 hover:opacity-85"
            )}
          >
            {t("save")}
          </button>
          <button
            onClick={onCancel}
            className="rounded-md border-[1.5px] border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors duration-150 hover:bg-muted"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Extend `MessageContent` and render the card in `ChatMessage.tsx`**

In `src/components/chat/ChatMessage.tsx`, add the import after line 16:

```typescript
import { RecipePreviewCard, type RecipePreview } from "./RecipePreviewCard";
```

Add to the `MessageContent` interface (after the `confirm` field, line 43):

```typescript
  recipePreview?: {
    recipe: RecipePreview;
    onSave: () => void;
    onCancel: () => void;
  };
```

In `AgentMessage`, render the card right after the `content.confirm` block (after line 271):

```tsx
        {content.recipePreview && (
          <RecipePreviewCard
            recipe={content.recipePreview.recipe}
            onSave={content.recipePreview.onSave}
            onCancel={content.recipePreview.onCancel}
          />
        )}
```

Update the agent branch condition at line 326 so a preview-only message still renders through `AgentMessage`:

```typescript
  if (content.text || content.confirm || content.recipePreview) {
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bunx vitest run tests/unit/chat/recipe-preview-card.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Typecheck + commit**

Run: `bunx tsc --noEmit`
Expected: no errors.

```bash
git add src/components/chat/RecipePreviewCard.tsx src/components/chat/ChatMessage.tsx tests/unit/chat/recipe-preview-card.test.tsx
git commit -m "feat(chat): add read-only RecipePreviewCard for import preview"
```

---

### Task 7: Render the preview card from `confirm.request` in `useChatStream`

**Files:**
- Modify: `src/components/chat/useChatStream.ts` (the `confirm.request` case, lines 371-410)

- [ ] **Step 1: Add the import-preview branch**

In `src/components/chat/useChatStream.ts`, add a type-only import near the top (after line 7):

```typescript
import type { RecipePreview } from "./RecipePreviewCard";
```

Replace the `case "confirm.request": {` block (lines 371-410) so import previews render the card and reuse the existing tool.invoked bubble (so the resume turn's `tool.completed` updates the same message and auto-nav still fires):

```typescript
      case "confirm.request": {
        streamingTextIdRef.current = null;

        // Recipe import preview: render the rich read-only card. Reuse the
        // tool.invoked bubble for this callId so the resume turn's
        // tool.completed updates the same message (and auto-nav fires).
        if (event.toolName === "importRecipeFromUrl") {
          const payload = event.payload as { recipe?: RecipePreview } | null;
          const recipe = payload?.recipe;
          if (recipe) {
            const existingId = callIdToMessageIdRef.current.get(event.callId);
            const targetId = existingId ?? nextId();
            const previewContent = {
              recipePreview: {
                recipe,
                onSave: async () => {
                  updateMessage(targetId, (prev) => ({
                    ...prev,
                    content: {
                      status: {
                        state: "pending" as StatusState,
                        message: translate.status(statusKeyToI18n("import.saving")),
                      },
                    },
                  }));
                  await resolveConfirm(event.callId, event.toolName, true, event.payload);
                },
                onCancel: async () => {
                  updateMessage(targetId, (prev) => ({
                    ...prev,
                    content: {
                      status: {
                        state: "success" as StatusState,
                        message: translate.cancelled(),
                      },
                    },
                  }));
                  await resolveConfirm(event.callId, event.toolName, false, event.payload);
                },
              },
            };
            if (existingId) {
              updateMessage(targetId, (prev) => ({ ...prev, content: previewContent }));
            } else {
              callIdToMessageIdRef.current.set(event.callId, targetId);
              appendMessage({ id: targetId, role: "agent", content: previewContent });
            }
            break;
          }
        }

        const id = nextId();
        const isGenerateImage = event.toolName === "generateRecipeImage";
        appendMessage({
          id,
          role: "agent",
          content: {
            text: isGenerateImage
              ? translate.confirmGenerateImage(event.message)
              : translate.confirmDelete(event.message),
            confirm: {
              confirmText: isGenerateImage ? translate.generateImageYes() : undefined,
              cancelText: isGenerateImage ? translate.generateImageNo() : undefined,
              variant: isGenerateImage ? "primary" : "destructive",
              onConfirm: async () => {
                removeMessage(id);
                await resolveConfirm(event.callId, event.toolName, true, event.payload);
              },
              onCancel: async () => {
                updateMessage(id, (prev) => ({
                  ...prev,
                  content: {
                    ...prev.content,
                    confirm: undefined,
                    status: {
                      state: "success",
                      message: isGenerateImage
                        ? translate.generateImageSkipped()
                        : translate.cancelled(),
                    },
                  },
                }));
                await resolveConfirm(event.callId, event.toolName, false, event.payload);
              },
            },
          },
        });
        break;
      }
```

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors. (`StatusState` is already imported at the top of the file — line 8.)

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/useChatStream.ts
git commit -m "feat(chat): render recipe import preview card from confirm.request"
```

---

### Task 8: Add `chat.preview.*` i18n keys (en, es, pl)

**Files:**
- Modify: `messages/en.json`, `messages/es.json`, `messages/pl.json`

- [ ] **Step 1: Add the `preview` block under `chat` in each locale**

In `messages/en.json`, inside the `"chat"` object (next to the existing `"confirm"` / `"statusKey"` keys), add:

```json
    "preview": {
      "save": "Save recipe",
      "cancel": "Cancel",
      "ingredients": "Ingredients",
      "steps": "Steps",
      "servings": "Servings",
      "prep": "Prep",
      "cook": "Cook",
      "minutesShort": "min"
    },
```

In `messages/es.json`:

```json
    "preview": {
      "save": "Guardar receta",
      "cancel": "Cancelar",
      "ingredients": "Ingredientes",
      "steps": "Pasos",
      "servings": "Porciones",
      "prep": "Prep.",
      "cook": "Cocción",
      "minutesShort": "min"
    },
```

In `messages/pl.json`:

```json
    "preview": {
      "save": "Zapisz przepis",
      "cancel": "Anuluj",
      "ingredients": "Składniki",
      "steps": "Kroki",
      "servings": "Porcje",
      "prep": "Przyg.",
      "cook": "Gotowanie",
      "minutesShort": "min"
    },
```

> Find the right insertion point with `rg -n '"confirm"|"statusKey"' messages/en.json`
> and place `"preview"` as a sibling key inside `"chat"`. Keep JSON valid (commas).

- [ ] **Step 2: Validate JSON parses**

Run: `bunx tsc --noEmit` (Next-intl JSON is imported as modules) and:
`node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8'));JSON.parse(require('fs').readFileSync('messages/es.json','utf8'));JSON.parse(require('fs').readFileSync('messages/pl.json','utf8'));console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/es.json messages/pl.json
git commit -m "i18n(chat): add recipe import preview card strings"
```

---

### Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full chat unit suite**

Run: `bunx vitest run tests/unit/chat`
Expected: PASS. Pay attention to: `import-recipe-tool`, `llm-gemma-text`, `runtime`, `import-recipe-image-tool`, `select-strategy`, `supadata-client`, `tools-registry`.

- [ ] **Step 2: Typecheck the whole project**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke (optional, requires running app)**

Start the app (`bun run dev`), open the chat, and ask it to import a recipe from a real recipe-site URL. Expected: a "Fetching the content…" status, then the rich preview card, then on **Save** the recipe persists and the browser navigates to `/recipes/:id`. On a non-recipe URL (e.g. a category page), expect a clean failure message, not a crash.

- [ ] **Step 4: Final commit (if any uncommitted verification fixups)**

```bash
git add -A
git commit -m "test(chat): verify AI web-recipe import + preview end-to-end" || true
```

---

## Notes / known-safe assumptions (verified while planning)

- **Auto-nav on the resume turn works without changes.** `tool.invoked` on the
  first turn registers `callId → messageId`; that turn ends at `confirm.request`
  without completing, so the mapping survives. On the resume (Save) turn,
  `execute` emits `tool.completed` with the same `callId`, the mapping is found,
  the bubble updates, and `AUTO_NAV_TOOLS` (which already includes
  `importRecipeFromUrl`) sets `pendingNavHref` → `finish` pushes the route.
- **The video path also gains the preview** for free (extraction now runs in
  `requiresConfirmation` for both strategies). No extra work.
- **No new cost cap** is added for web extraction (out of scope). The existing
  `recipeImport` entitlement check inside `persistRecipe` still gates saves.
- **Out of scope:** JSON-LD extraction, Supadata `/extract` for web, inline card
  editing, preview for image import.
