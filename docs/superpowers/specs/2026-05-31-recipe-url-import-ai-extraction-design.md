# Recipe URL Import — AI Extraction + Preview Before Save

**Date:** 2026-05-31
**Status:** Approved design — ready for implementation plan
**Linear context:** follow-up to DIE-35 (Supadata ingest pipeline)
**Author:** brainstorming session (audit of `importRecipeFromUrl`)

---

## Problem

Importing a recipe from a **website** (non-video URL) fails on most real recipe
sites. The user sees the agent fall back to:

> "It looks like the page didn't have extractable ingredients…"

### Root cause

The web path is asymmetric with the video path:

| Path | Extraction engine |
|------|-------------------|
| Video (YouTube/TikTok/IG/FB/X) | `/extract` with **AI + JSON Schema** → structured, robust |
| Web (recipe sites) | `/web/scrape` → markdown → **brittle REGEX parser** |

The web branch of `extractViaSupadata` calls Supadata `/web/scrape` (returns
markdown) and then `parseRecipeFromScrape` — a regex parser
(`src/lib/chat/ingestion/markdown-recipe-parser.ts`) that only succeeds when the
scraped markdown contains literal `## Ingredients` / `## Instructions` headers
immediately followed by a bullet/numbered list. Real recipe sites render
ingredients in tables, divs, and custom widgets, so scrape-to-markdown rarely
produces that exact shape. When the regex finds zero ingredients, the tool's
`no-ingredients` guard (`importRecipeFromUrl.ts:189-206`) fires and the import
fails.

The ingredient line parser is also fragile: `/^(\d+...)([a-z]+)?\s+(.+)$/` fails
on "Salt to taste", "½ cup", "1 (14 oz) can", and ranges like "2-3 cloves".

### Supadata reality (verified via context7)

- `/web/scrape` is a markdown **fetcher**, not a recipe extractor. It is good at
  fetching JS-heavy / anti-bot pages and returns `content` (markdown) plus
  `name` / `description` / `ogUrl` metadata.
- The `/extract` JSON-Schema path used for video is **not documented** as
  accepting arbitrary web URLs, so we do not depend on it for the web path.

---

## Decisions

Settled during brainstorming:

1. **Focus:** web recipe sites (the failing case). The video path is not changed
   beyond inheriting the preview flow for free.
2. **Engine — Approach A:** AI extraction over Supadata's scraped markdown,
   mirroring the existing image-import pattern. Keep `/web/scrape` for robust
   fetching; replace the regex with an LLM extraction step.
3. **Preview before save:** the tool proposes the extracted recipe; the user
   confirms before anything is persisted.
4. **Preview UI — rich read-only card:** show title, image, ingredients, steps,
   times/servings.
5. **Editing — reuse existing editor post-save:** the card is read-only with
   Save / Cancel. "Editing" happens on the recipe page after save, which already
   has a full editor and is already auto-navigated to after import.

### Rejected / deferred

- **Approach B (JSON-LD `schema.org/Recipe` first, AI fallback):** more accurate
  and cheaper at scale, but requires self-fetching raw HTML (reintroduces the
  anti-bot problem Supadata solves). Deferred as a fast-follow if ingredient
  accuracy or Supadata cost becomes a concern.
- **Approach C (`/extract` for web URLs):** unverified Supadata capability;
  would require a real test before committing.
- **Inline editing inside the chat card:** rebuilds the recipe editor in a chat
  bubble. Rejected — the recipe page editor already exists.
- **Preview for image import:** the card is built reusable, but wiring it to
  `importRecipeFromImage` is out of scope for this change.

---

## Architecture

### Existing machinery this builds on

The runtime already supports a confirmation pause/resume cycle
(`src/lib/chat/runtime.ts:295-308`):

1. Before `execute`, the runtime calls `tool.requiresConfirmation(input, ctx)`.
2. If it returns a `ConfirmDescriptor { message, payload }`, the runtime emits a
   `confirm.request` event (carrying `message` + `payload`) and **stops**.
3. The client renders a confirmation UI; on accept it re-calls `run()` with
   `pendingResolve { accepted, payload }`.
4. The runtime re-dispatches the tool's `execute` with `input = payload`.

The `payload` travels deterministically from `requiresConfirmation` back into
`execute`. This lets us **extract once** (during the confirmation phase), show a
preview, and persist on confirm **without re-extracting**.

### End-to-end flow

```
User pastes URL
  → agent calls importRecipeFromUrl({ url })
  → requiresConfirmation(input, ctx):           [extraction happens ONCE here]
       scrapeWeb(url) → extractRecipeFromText(markdown)
       ├─ valid recipe (title + ≥1 ingredient)
       │     return { message, payload: { url, confirmed: true, recipe } }
       │     runtime emits confirm.request (payload carries the recipe) and PAUSES
       │     → UI renders RecipePreviewCard (read-only) + Save / Cancel
       │         Save   → resolveConfirm(true, payload)
       │         Cancel → resolveConfirm(false, payload)
       └─ no recipe / scrape failed / LLM error
             throw ToolFailure(reason)
             runtime (new try/catch) → tool.failed { reason }
  → execute({ confirmed: true, recipe }):        [persists only, does NOT re-extract]
       persistRecipe(recipe) → link to /recipes/:id
  → finish → existing auto-nav redirects to the recipe page (full editor)
```

---

## Components

### 1. `src/lib/chat/llm-gemma.ts` — text extraction + shared provider

- **New method** `GemmaProvider.extractRecipeFromText({ content, locale, sourceUrl }): Promise<ImportedRecipeData>`.
  - Mirrors `extractRecipe` (image): same Gemini model, same `generateObject`
    against `importedRecipeSchema`, same `GemmaExtractionError` mapping.
  - New text prompt: extract a structured recipe from scraped web-page markdown
    that may contain navigation/ads/comments; keep only the recipe; **return an
    empty `ingredients` array if no recipe is present** (same contract as the
    image path). Keep source-language note.
  - Shared internals (JSON parse + Zod validation + error mapping) factored into
    a private helper reused by `extractRecipe` and `extractRecipeFromText`.
  - **Truncate `content` to ~24k characters** before sending (recipes fit
    comfortably; bounds token cost).
- **Move** `getProvider()` and `setGemmaProviderForTest()` out of
  `importRecipeFromImage.ts` into `llm-gemma.ts` as a shared singleton so both
  the image and URL tools use the same provider and test hook.

### 2. `src/lib/chat/tools/importRecipeFromUrl.ts` — confirmation + persist split

- **Input schema** grows: `{ url, hint?, confirmed?: boolean, recipe?: <importedRecipeSchema shape> }`.
- **`requiresConfirmation(input, ctx)`** (heavy work lives here):
  1. If `input.confirmed` → `return null` (resume path → `execute` persists).
  2. Else:
     - `selectIngestStrategy(url)` → `scrapeWeb` (web) or `extractVideo` (video).
       Web path: `scrapeWeb(url)` → `extractRecipeFromText(scrape.content)`,
       using `scrape.name` / `scrape.description` / `scrape.ogUrl` as fallbacks
       for title / description / image.
     - Valid recipe (title length ≥ 3 and ≥ 1 ingredient) →
       `return { message: previewSummary, payload: { url, confirmed: true, recipe } }`.
     - No recipe / scrape error / LLM error → **throw `ToolFailure(reason)`**
       (`ingest-failed` | `no-ingredients` | `extraction-failed`).
- **`execute(input, ctx)`** (resume path, already confirmed): persist
  `input.recipe` via `persistRecipe` with `source: "url"`. No re-extraction. Map
  persist errors as today (`PRO_ONLY` → unauthorized, `QUOTA_EXCEEDED` → quota).
- **Delete** the call to `parseRecipeFromScrape`.
- Keep the existing `logImportFailure` telemetry on every failure branch.

### 3. `src/lib/chat/runtime.ts` — failable confirmation gate

- Wrap `tool.requiresConfirmation(call.input, ctx)` (runtime.ts:296) in a
  `try/catch`. On a typed `ToolFailure` error, emit
  `tool.failed { toolName, callId, reason }` and return — same shape the dispatch
  loop already emits elsewhere. This is required so the preview phase can **fail
  cleanly** when no recipe is found; without it, a throw there would error the
  whole turn.
- Define/locate `ToolFailure` (a small typed error carrying `reason` and
  optional `message`). If an equivalent typed tool error already exists
  (`ToolStatusError`-style), reuse it; otherwise add a minimal class.
- The `confirm.request` event already forwards `payload` to the client
  (`useChatStream.ts:44`), so the structured recipe reaches the UI with no extra
  event-shape change.

### 4. `src/components/chat/RecipePreviewCard.tsx` — new, read-only

- Renders `payload.recipe`: title, image (if any), ingredient list, instruction
  steps, prep/cook time, servings. Read-only.
- Actions: **Save** → `resolveConfirm(callId, toolName, true, payload)`;
  **Cancel** → `resolveConfirm(callId, toolName, false, payload)`.
- Built reusable so image import can adopt it later (not wired now).

### 5. `src/components/chat/useChatStream.ts` — render the card

- In the `confirm.request` handler (useChatStream.ts:371), branch on
  `toolName === "importRecipeFromUrl"`: render `RecipePreviewCard` (reading
  `event.payload.recipe`) instead of the plain `ConfirmInline` yes/no.
- Other tools (delete, generate-image) keep `ConfirmInline`.

### 6. i18n — `messages/{es,en,pl}.json`

- Card labels (Save, Cancel, "Ingredients", "Steps", servings/time labels).
- Reuse existing `chat.statusKey.import.fetching` / `import.extracting`.

### 7. Delete `src/lib/chat/ingestion/markdown-recipe-parser.ts` + its test.

---

## Testing (TDD — red first)

- **`extractRecipeFromText`** (mock Gemini client): markdown with a recipe →
  structured `ImportedRecipeData`; markdown without a recipe → empty
  `ingredients`; oversized markdown → truncated input.
- **`importRecipeFromUrl`** (mock provider via `setGemmaProviderForTest` + existing
  Supadata mock):
  - `requiresConfirmation`: valid recipe → descriptor with `payload.recipe`;
    no recipe → throws `ToolFailure("no-ingredients")`; scrape failure → throws
    `ToolFailure("ingest-failed")`; LLM error → throws
    `ToolFailure("extraction-failed")`.
  - `execute({ confirmed: true, recipe })`: persists from payload, returns the
    `/recipes/:id` link, does **not** call the extractor again.
- **`runtime`**: a tool whose `requiresConfirmation` throws `ToolFailure` yields
  `tool.failed { reason }` (not an unhandled turn error).
- **Replace** `markdown-recipe-parser.test.ts`.
- Optional: a light render test for `RecipePreviewCard`.

---

## Risks / verify during implementation

- **Auto-nav on the resume turn:** confirm the existing post-import redirect
  fires on the **resumed** (post-confirm) turn's tool result, not only on a
  direct turn.
- **Cost cap:** confirm `extractRecipeFromText` inherits the provider's daily
  cost cap (same path as image extraction).
- **Status during preview:** `requiresConfirmation` does not receive `emit`, so
  the user sees a single `import.fetching` status before the card appears.
  Acceptable; extending the signature to emit an `import.extracting` status is
  out of scope.
- **Video path parity:** the video branch now also routes through
  `requiresConfirmation` and gains the preview. Verify `extractVideo` failures
  map to the same `ToolFailure` reasons.

---

## Out of scope (YAGNI)

JSON-LD / `schema.org/Recipe` extraction (Approach B) · Supadata `/extract` for
web (Approach C) · inline editing in the chat card · preview for image import ·
extending `requiresConfirmation` with an `emit` for a separate "extracting"
status.
