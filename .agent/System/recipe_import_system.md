# Recipe Import System

**Document Last Updated:** 2026-06-14
**Status:** Recipe import runs on one shared pipeline (Supadata + Gemma), reachable
from both the in-app AI chat and the "Add Recipe" modal.

---

## Overview

Recipe import has a single extraction engine used by two entry points:

- **AI chat assistant** — conversational. Tools `importRecipeFromUrl`
  (Supadata + Gemma) and `importRecipeFromImage` (Gemma) under
  `src/lib/chat/tools/`.
- **"Add Recipe" modal** — directed. The modal's **Import** option lets the user
  paste a URL or upload a photo/PDF; it extracts via the same engine, prefills
  the recipe form, shows a **preview**, and saves through the normal create flow.

The old Browser-Use Cloud (URL) and Google Document AI (photo/PDF) paths were
**discontinued** on 2026-06-14 in favour of Supadata + Gemma, which proved more
reliable. Browser-Use remains in use, but only for grocery **shopping**.

The "Add Recipe" modal offers three entry points:
- **Create manually** — the step-by-step form (`step0` → `step1` → `step2`).
- **Ask the Dietai assistant** — opens the chat with a seed prompt.
- **Import from URL or photo** — see below.

See [`EntryScreen.tsx`](../../src/components/recipes/modal/screens/EntryScreen.tsx)
and the modal state machine in
[`use-recipe-flow.ts`](../../src/hooks/use-recipe-flow.ts).

---

## Shared extraction engine

- **URL:** [`extractRecipe`](../../src/lib/ingest/extract-recipe.ts) — picks a
  Supadata strategy via [`select-strategy.ts`](../../src/lib/chat/ingestion/select-strategy.ts):
  video/social hosts → Supadata `/extract`; other pages → Supadata `/web/scrape`
  markdown → **Gemma** (`extractRecipeFromText`). Returns an `ImportedRecipe`.
  Both the chat tool `importRecipeFromUrl` and the modal route call this.
- **Image / PDF:** [`GemmaProvider.extractRecipe`](../../src/lib/chat/llm-gemma.ts)
  (Gemini 2.5 Flash) — vision + native PDF. Returns `ImportedRecipeData`.
  Both the chat tool `importRecipeFromImage` and the modal route call this.

---

## Modal import flow (entry point: "Import")

1. **URL:** `POST /api/recipes/import/url` `{ url, locale }` →
   [`route.ts`](../../src/app/api/recipes/import/url/route.ts). Auth +
   `assertCanImportRecipe` → `extractRecipe` → `{ recipe }`. Synchronous JSON
   (no SSE / taskId).
2. **Photo / PDF:** `POST /api/recipes/import/image` (multipart `file`) →
   [`route.ts`](../../src/app/api/recipes/import/image/route.ts). Auth +
   `assertCanImportRecipe` + the shared **daily cap**
   ([`multimodal-cap.ts`](../../src/lib/chat/multimodal-cap.ts)). Stores the file
   in the `chat-recipe-media` bucket (records a `MultimodalImportEvent` for cost
   accounting + 7-day retention), runs Gemma, returns `{ recipe, eventId }`.
   Accepts JPEG/PNG/WebP/HEIC + **PDF** (PDFs pass straight to Gemini; the
   sharp/HEIC conversion is image-only).
3. The modal maps the result into an `ImportedRecipe`, prefills the form via
   [`importedToFormData`](../../src/lib/recipe-utils.ts), and shows the
   **PreviewScreen** ("Save as is" / "Edit before saving").
4. Save runs through the normal create flow
   ([`use-recipe-form.ts`](../../src/hooks/use-recipe-form.ts) `handleSubmit`),
   which derives provenance from `sourceUrl` (`http*` → `source: "url"`,
   filename → `source: "imported"`) and `persistRecipe` re-checks the import
   entitlement and tags the recipe as imported.

---

## Chat import flow

Same engine; see [Chat AI Agent](./chat_agent.md) for the agent runtime and tool
contract. The URL tool previews + confirms before persisting; the image tool
resolves an `eventId` from `/api/chat/upload`, runs Gemma, and persists.

---

## Notes

- No new dependencies — Supadata + `@google/genai` already power the chat.
  `@google-cloud/documentai` and `pdf-lib` were removed with Document AI.
- **Browser-Use is shopping-only** (`/api/shopping/automate/*`,
  `src/actions/shopping-automation.ts`, `src/components/shopping/*`). The shared
  `BrowserUseClient` and `BROWSER_USE_API_KEY` env var remain for shopping.
