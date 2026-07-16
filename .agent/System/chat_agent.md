# Chat AI Agent — Architecture

**Purpose:** How the in-app DietAI chat agent is wired — the runtime, the LLM
provider seam, the tool registry, and how the system prompt is composed.

Last Updated: 2026-06-03

---

## Overview

The chat agent is a **command bar, not a display surface**: it triggers real
product actions (create/import/edit recipes, build & edit meal plans) and replies
with short text + links into the existing UI. It never renders recipe cards or
macro panels inside the chat.

Code lives under:
- `src/lib/chat/` — runtime, providers, prompt, tools, guardrails
- `src/app/api/chat/` — SSE route + conversation/session/upload endpoints
- `src/components/chat/` — drawer UI + `useChatStream`

---

## Core seams

### AgentRuntime (`src/lib/chat/runtime.ts`)

Stateless orchestrator. Constructed once with collaborators; every `run()` is
independent.

```
run(req: RunRequest, signal?) → AsyncIterable<AgentEvent>
```

Responsibilities: load history → build system prompt → filter tools by
entitlement → stream the model → dispatch tool calls (concurrency-capped) →
run the streaming nutrition guardrail → handle confirmation gating → persist the
turn. Domain events (`AgentEvent` in `events.ts`), not raw provider events, are
yielded.

**Turn durability:** `run()` persists exactly once via a `persistTurn` closure —
explicitly on the happy path (store failures surface as stream errors) and from
a `finally` safety net on abnormal exits. Provider throws (Anthropic 529/401)
and client disconnects (the SSE consumer abandons the generator, which aborts
`llm.stream` mid-iteration) both land in the `finally`, so the user message and
any partial assistant text survive a mid-stream refresh.

Successful tool-results are persisted as `{ ok, data, link }` — the `link`
rides along so `serialize.ts` can re-render the tool's link affordance when the
conversation is rehydrated on reload.

### LlmProvider (`src/lib/chat/llm-provider.ts`) — real seam

One method: `stream(request) → AsyncIterable<ProviderStreamEvent>`. Adapters:
- `AnthropicLlmProvider` (`llm-anthropic.ts`) — Claude via `@ai-sdk/anthropic`.
- `MockLlmProvider` (`llm-mock.ts`) — intent pattern-matching for dev/test.

**Implicit contract:** providers present tools to the model **without** `execute`
so the runtime intercepts tool calls itself (for concurrency cap, entitlement
re-check, confirmation gating, guardrail). See `llm-anthropic.ts:toAiSdkTools`.

> Note: `llm-gemma.ts` is NOT an `LlmProvider` — it's a recipe-extraction service
> used by the import tools. Misfiled under `llm-*` by name only.

### ConversationStore (`src/lib/chat/conversation-store.ts`) — real seam

`load` / `append` / `clear`. Production adapter `PrismaConversationStore`;
in-memory adapters used in tests/evals.

`PrismaConversationStore.append` does two persistence-shape transforms:
1. **Delta coalescing** — the runtime pushes one text item per streamed delta;
   consecutive same-role text items are merged so a turn stores a handful of
   rows, not one per token chunk (mirrors the read-side coalescing in
   `serialize.ts` and `toModelMessages`).
2. **Explicit monotonic `createdAt`** — Postgres `now()` is transaction-stable,
   so default timestamps tie within one `createMany` and `load()`'s
   `ORDER BY createdAt` would be non-deterministic (scrambled deltas, inverted
   tool-call/result pairs → provider 400s). Each row gets `base + index` ms.

---

## Tools

The registry (`src/lib/chat/tools/index.ts`, `allTools`) is the single source of
truth for what the agent can call. Each tool is a plain object (no AI-SDK / MCP
imports) so the same registry feeds the in-app runtime today and an MCP server
later.

A `Tool` (`tools/types.ts`) carries **two distinct channels to the model**:

| Field | Channel | Holds |
|-------|---------|-------|
| `description` | function-calling schema (sent on the tool definition) | *what* the tool is + its params. Kept tight. |
| `guidance` (optional) | system prompt | *when & how* to call it — sequencing, post-conditions, confirmation, attachment protocol. |

Plus: `inputSchema` (Zod), `statusKey` (`ToolStatusKey`), `requiresFeature`
(entitlement gate), `requiresConfirmation` (destructive-action preview),
`execute`.

**Confirmation UX contract:** `confirm.request` carries the gated tool's
`statusKey` so the client can swap the `tool.invoked` pending-spinner bubble
for the confirmation prompt (and restore the in-progress status on the same
bubble when the user accepts). Without the swap, the spinner runs alongside
the question — and forever if the user declines.

**Post-import image offers:** `importRecipeFromUrl` returns `hasImage` in its
result data; `generateRecipeImage.guidance` instructs the model to offer
generation (askFirst) only when `hasImage` is false. Deterministic backstop:
an unconfirmed `askFirst` call on a recipe that already has an `imageUrl`
skips the prompt (`requiresConfirmation` → null) and `execute` no-ops with
`skippedExistingImage: true` instead of generating.

**Entitlement filtering (hybrid C+B):** Layer A filters `allTools` by
`ctx.entitlements.features[requiresFeature]` at turn entry; Layer B re-checks
defensively at dispatch (`runtime.ts`). Feature flags (e.g.
`FEATURE_MULTIMODAL_IMPORT` gating `importRecipeFromImage`) are applied at the
**registry** level only.

---

## System prompt composition (`src/lib/chat/system-prompt.ts`)

`buildSystemPrompt(locale, page?, tools?)` composes the prompt from the **active
(entitlement-filtered) tool set** the runtime passes in. Prompt knowledge is
split three ways:

1. **Global policy** (Category 1) — command-bar principle, nutrition guardrail,
   medical refusal, output brevity, locale. Lives in `COMMON` / `LOCALE_SUFFIX`.
2. **Single-tool guidance** (Category 2) — each tool's `guidance`, folded into a
   composed `TOOL NOTES.` section. Owned by the tool, not the prompt.
3. **Cross-tool workflows** (Category 3) — rules that sequence multiple tools
   (id-resolution, `searchMealPlans → getMealPlan → addMealToDay`). Stay in
   `COMMON`. Note: `getNutrition` is self-persisting (see below), so there is no
   longer a `getNutrition → editRecipe` save step in the prompt.

**Why composition matters — desync elimination:** because the prompt is built
from the registered/filtered tool set, it can only describe tools the user can
actually call. The previous double-check (a feature-flag test in *both* the
registry and the prompt that had to agree) is gone; the flag lives only in
`tools/index.ts`.

Tests: `tests/unit/chat/system-prompt-guidance.test.ts` (composition + desync
invariant), `tests/unit/chat/tool-guidance.test.ts` (moved rules pinned to their
tools), `tests/unit/chat/system-prompt.test.ts` (Category-1 word-presence guard).

---

## Nutrition guardrail (Layer 2 redactor) — streaming context

`StreamingGuardrail` (`nutrition-guardrail.ts`) carries a ≤30-char `tail` of
already-emitted text into each window's keyword-proximity check, so a keyword
flushed in a previous window ("calorías de ") still vouches for a number
arriving in the next ("450"). Line-leading list ordinals ("6." / "6)") are
exempt from redaction — the system prompt steers the model toward plain-text
enumerations and ordinals are list markers, not macro values. Known limitation
(pre-existing): a number emitted in a window *before* its keyword arrives
(">450" flushed, "kcal" next chunk) can still slip through; fixing it would
delay all streaming output by the proximity window.

## getNutrition: stored-profile consistency & grounding (DIE-43)

`getNutrition` (`tools/getNutrition.ts`) is the single authoritative source of
nutrition numbers in chat. For a saved recipe that already carries a per-serving
profile (`recipe.calories != null`, persisted by DIE-42) it returns the stored
columns **verbatim** (`source: "stored"`) — the chat figure equals the recipe
detail page at zero FDC cost. With no stored profile, or an ad-hoc ingredient
list, it analyzes fresh through `analyzeRecipeProfileAction` (`source: "fdc"`).

**Self-persisting (backfill):** when it freshly analyzes a recipe the user
*owns*, `getNutrition` writes the full 22-nutrient profile back via
`saveRecipeNutritionProfile` (`actions/recipe.ts`, ownership-checked,
best-effort). This is why the prompt no longer tells the model to call
`editRecipe` to save macros — that path only persisted the 5 macros and dropped
every micronutrient, so the detail page showed macros but no micros. Ad-hoc
ingredient lists and non-owned (public) recipes are never written.

The result carries the full 22-nutrient picture: `perServing` + `total` macros
plus a per-serving `micros` map (legacy rows without micros report `null`, never
`0`). `groundedValues` feeds the Layer-2 redactor (`runtime.ts` →
`StreamingGuardrail.addGroundedValues`) and now includes **both macros and
micros** — the redactor's keyword set only policies macro terms, so grounding the
micros keeps a legit micro figure (e.g. "80 mg calcium") from being collaterally
redacted when it lands within the proximity window of a macro keyword.

## Safety: medical-refusal classifier — see ADR-0001

Per decision #117 there is **no regex/ML classifier** — the system prompt prose
(NUTRITION GUARDRAIL + MEDICAL ADVICE blocks) is the *sole* enforcement layer.
The unit test only checks **word-presence**, not behavior. Any refactor of the
guardrail/refusal prose must first have the behavioral net green (opt-in Vitest
test, so the `server-only` alias resolves the full tool registry):

```
RUN_REFUSAL_EVAL=1 ANTHROPIC_API_KEY=… bunx vitest run tests/eval/medical-refusal.test.ts
```

This is why Category-2 extraction deliberately stopped short of the safety-fused
mentions (e.g. "call getNutrition" inside the guardrail). See
[`docs/adr/0001-system-prompt-is-sole-medical-refusal-classifier.md`](../../docs/adr/0001-system-prompt-is-sole-medical-refusal-classifier.md).

---

## When to read

- Adding or changing a chat tool (and how it's described to the model)
- Touching the system prompt or agent behavior
- Adding an LLM provider or conversation store backend
- Anything involving the medical-refusal / nutrition guardrails
