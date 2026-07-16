# Ingredient LLM Name Canonicalizer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cached Gemini fallback that normalizes untranslatable ingredient names to USDA-friendly English, behind the deterministic match layer and in front of the match-quality guard.

**Architecture:** Two-pass resolution in `resolveIngredientMatches`: pass 1 is today's deterministic path; ingredients that end as no-match are batch-canonicalized by Gemini (cached), then a pass 2 re-runs search/rank/guard with the canonical name. LLM is fallback-only, flag-gated, best-effort (failure never breaks analysis).

**Tech Stack:** TypeScript, Next.js server actions, Prisma (Postgres), `@google/genai` (Vertex, gemini-2.5-flash), Zod, Vitest.

**Spec:** [.agent/Tasks/ingredient-llm-canonicalizer.md](./ingredient-llm-canonicalizer.md)

**House rules:** bun (never npm); rg/fd/bat/eza (not grep/find/ls); never run a production build; conventional commits, NO AI attribution; Strict TDD (watch each test fail first).

---

## File structure

- **Create** `src/lib/ingredient-canonicalizer.ts` — Gemini batch canonicalizer (one responsibility: names → canonical English). Testable via injected fake client.
- **Create** `src/lib/ingredient-name-repo.ts` — `canonicalizeCached`: cache read/upsert + flag gate. Wraps the canonicalizer.
- **Modify** `prisma/schema.prisma` — add `IngredientNameCache` model.
- **Create** `prisma/migrations/20260621000000_ingredient_name_cache/migration.sql` — applied via the shared-DB drift workflow.
- **Modify** `src/actions/analyzeRecipe.ts` — extract `resolveBatch`, add the two-pass fallback.
- **Create** tests: `tests/unit/ingredient-canonicalizer.test.ts`, `tests/unit/ingredient-name-repo.test.ts`, `tests/unit/canonicalizer-fallback.test.ts`.

---

## Task 1: `IngredientNameCache` Prisma model + migration

**Files:**
- Modify: `prisma/schema.prisma` (add model near `FdcSearchCache`, ~line 197)
- Create: `prisma/migrations/20260621000000_ingredient_name_cache/migration.sql`

- [ ] **Step 1: Add the model to the schema**

In `prisma/schema.prisma`, after the `FdcSearchCache` model:

```prisma
model IngredientNameCache {
  key           String   @id // normalized raw name (lowercased, whitespace-collapsed)
  canonical     String? // English canonical name, or null = not a food
  lastFetchedAt DateTime @default(now())

  @@index([lastFetchedAt])
}
```

- [ ] **Step 2: Regenerate the Prisma client**

Run: `bunx prisma generate`
Expected: "Generated Prisma Client" — `IngredientNameCache` now available on `prisma`.

- [ ] **Step 3: Write the migration SQL**

Create `prisma/migrations/20260621000000_ingredient_name_cache/migration.sql`:

```sql
CREATE TABLE "IngredientNameCache" (
    "key" TEXT NOT NULL,
    "canonical" TEXT,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IngredientNameCache_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "IngredientNameCache_lastFetchedAt_idx" ON "IngredientNameCache"("lastFetchedAt");
```

- [ ] **Step 4: Apply to the shared dev DB (drift workflow — NOT `migrate dev`)**

Run:
```bash
bunx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20260621000000_ingredient_name_cache/migration.sql
bunx prisma migrate resolve --applied 20260621000000_ingredient_name_cache
```
Expected: SQL executes; migration marked applied. (`migrate dev` would try to reset the remote dev DB — do not use it.)

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260621000000_ingredient_name_cache
git commit -m "feat(nutrition): add IngredientNameCache model"
```

---

## Task 2: `IngredientCanonicalizer` (Gemini batch)

**Files:**
- Create: `src/lib/ingredient-canonicalizer.ts`
- Test: `tests/unit/ingredient-canonicalizer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { IngredientCanonicalizer } from "@/lib/ingredient-canonicalizer";

function fakeClient(text: string | (() => never)) {
  return {
    models: {
      generateContent: vi.fn(async () => {
        if (typeof text === "function") text();
        return { text };
      }),
    },
  } as never;
}

describe("IngredientCanonicalizer", () => {
  it("maps each raw name to its canonical (null preserved)", async () => {
    const c = new IngredientCanonicalizer({
      clientOverride: fakeClient(
        JSON.stringify({
          items: [
            { raw: "łosoś świeży", canonical: "salmon" },
            { raw: "Posiłek 1", canonical: null },
          ],
        })
      ),
    });
    const out = await c.canonicalize(["łosoś świeży", "Posiłek 1"]);
    expect(out.get("łosoś świeży")).toBe("salmon");
    expect(out.get("Posiłek 1")).toBeNull();
  });

  it("returns an empty map on transport failure (best-effort, never throws)", async () => {
    const c = new IngredientCanonicalizer({
      clientOverride: fakeClient(() => {
        throw new Error("vertex down");
      }),
    });
    const out = await c.canonicalize(["whatever"]);
    expect(out.size).toBe(0);
  });

  it("returns an empty map for no input without calling the model", async () => {
    const client = fakeClient("{}");
    const c = new IngredientCanonicalizer({ clientOverride: client });
    const out = await c.canonicalize([]);
    expect(out.size).toBe(0);
    expect((client as never as { models: { generateContent: { mock: { calls: [] } } } }).models.generateContent).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/unit/ingredient-canonicalizer.test.ts`
Expected: FAIL — cannot resolve `@/lib/ingredient-canonicalizer`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/ingredient-canonicalizer.ts`:

```ts
/**
 * LLM ingredient-name canonicalizer (Gemini, Vertex).
 *
 * Normalizes a free-text / multilingual ingredient name to a generic English
 * name suitable for USDA FoodData Central matching. Used ONLY as a cached
 * fallback (see ingredient-name-repo + resolveIngredientMatches). Best-effort:
 * any failure returns an empty map so recipe analysis never breaks.
 *
 * @module lib/ingredient-canonicalizer
 */
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { buildGenAIVertexOptions } from "./chat/tools/genai-options";

const DEFAULT_MODEL = "gemini-2.5-flash";

const responseSchema = z.object({
  items: z.array(
    z.object({ raw: z.string(), canonical: z.string().nullable() })
  ),
});

const SYSTEM_INSTRUCTION = `You normalize recipe ingredient names for the USDA FoodData Central database.
For each input name return a generic English ingredient name: singular, no brand, no preparation/state words, no quantities.
Examples: "mięso z piersi kurczaka" -> "chicken breast"; "oliwa z oliwek" -> "olive oil"; "komosa ryżowa" -> "quinoa".
Return canonical = null for anything that is not a food ingredient (section headers, utensils, noise).
Return exactly one object per input and copy the input verbatim into "raw".`;

export class IngredientCanonicalizer {
  private readonly client: Pick<GoogleGenAI, "models">;
  private readonly modelId: string;

  constructor(
    opts: { clientOverride?: Pick<GoogleGenAI, "models">; model?: string } = {}
  ) {
    this.modelId = opts.model ?? process.env.GEMMA_MODEL ?? DEFAULT_MODEL;
    if (opts.clientOverride) {
      this.client = opts.clientOverride;
    } else {
      const options = buildGenAIVertexOptions(process.env);
      if (!options) {
        throw new Error(
          "IngredientCanonicalizer: GOOGLE_CLOUD_PROJECT_ID is not set in environment."
        );
      }
      this.client = new GoogleGenAI(options);
    }
  }

  async canonicalize(rawNames: string[]): Promise<Map<string, string | null>> {
    const out = new Map<string, string | null>();
    if (rawNames.length === 0) return out;
    try {
      const prompt = `Normalize these ingredient names:\n${rawNames
        .map((n, i) => `${i + 1}. ${n}`)
        .join("\n")}`;
      const response = await this.client.models.generateContent({
        model: this.modelId,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: zodToJsonSchema(responseSchema),
        },
      });
      const text = response.text;
      if (!text) return out;
      const parsed = responseSchema.parse(JSON.parse(text));
      for (const item of parsed.items) out.set(item.raw, item.canonical);
    } catch (err) {
      console.error(
        "[ingredient-canonicalizer] failed:",
        err instanceof Error ? err.message : String(err)
      );
      return new Map();
    }
    return out;
  }
}

let providerOverride: IngredientCanonicalizer | null = null;
let providerSingleton: IngredientCanonicalizer | null = null;

export function setIngredientCanonicalizerForTest(
  c: IngredientCanonicalizer | null
): void {
  providerOverride = c;
}

export function getIngredientCanonicalizer(): IngredientCanonicalizer {
  if (providerOverride) return providerOverride;
  if (!providerSingleton) providerSingleton = new IngredientCanonicalizer();
  return providerSingleton;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/unit/ingredient-canonicalizer.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ingredient-canonicalizer.ts tests/unit/ingredient-canonicalizer.test.ts
git commit -m "feat(nutrition): add Gemini ingredient-name canonicalizer"
```

---

## Task 3: `canonicalizeCached` (cache + flag gate)

**Files:**
- Create: `src/lib/ingredient-name-repo.ts`
- Test: `tests/unit/ingredient-name-repo.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ingredientNameCache: { findMany: vi.fn(), upsert: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  IngredientCanonicalizer,
  setIngredientCanonicalizerForTest,
} from "@/lib/ingredient-canonicalizer";
import { canonicalizeCached } from "@/lib/ingredient-name-repo";

const fakeCanon = (map: Record<string, string | null>) =>
  ({
    canonicalize: vi.fn(async (names: string[]) => {
      const m = new Map<string, string | null>();
      for (const n of names) if (n in map) m.set(n, map[n]);
      return m;
    }),
  }) as unknown as IngredientCanonicalizer;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("INGREDIENT_LLM_FALLBACK", "1");
  setIngredientCanonicalizerForTest(null);
});
afterEach(() => vi.unstubAllEnvs());

describe("canonicalizeCached", () => {
  it("returns an empty map and skips the DB when the flag is off", async () => {
    vi.stubEnv("INGREDIENT_LLM_FALLBACK", "0");
    const out = await canonicalizeCached(["łosoś"]);
    expect(out.size).toBe(0);
    expect(prisma.ingredientNameCache.findMany).not.toHaveBeenCalled();
  });

  it("serves a cache hit without calling the LLM", async () => {
    vi.mocked(prisma.ingredientNameCache.findMany).mockResolvedValue([
      { key: "łosoś", canonical: "salmon", lastFetchedAt: new Date() },
    ] as never);
    const canon = fakeCanon({});
    setIngredientCanonicalizerForTest(canon);

    const out = await canonicalizeCached(["łosoś"]);
    expect(out.get("łosoś")).toBe("salmon");
    expect(canon.canonicalize).not.toHaveBeenCalled();
  });

  it("calls the LLM for a miss and upserts the result", async () => {
    vi.mocked(prisma.ingredientNameCache.findMany).mockResolvedValue([] as never);
    setIngredientCanonicalizerForTest(fakeCanon({ "komosa ryżowa": "quinoa" }));

    const out = await canonicalizeCached(["komosa ryżowa"]);
    expect(out.get("komosa ryżowa")).toBe("quinoa");
    expect(prisma.ingredientNameCache.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "komosa ryżowa" },
        create: { key: "komosa ryżowa", canonical: "quinoa" },
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/unit/ingredient-name-repo.test.ts`
Expected: FAIL — cannot resolve `@/lib/ingredient-name-repo`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/ingredient-name-repo.ts`:

```ts
/**
 * Cached ingredient-name canonicalization.
 *
 * Reads/writes IngredientNameCache and only calls the LLM for cache misses.
 * Gated by INGREDIENT_LLM_FALLBACK — when off, returns an empty map and never
 * touches the DB or the model. Mappings are stable, so a name is canonicalized
 * at most once system-wide (nulls are cached too, so confirmed non-foods are
 * not re-queried).
 *
 * @module lib/ingredient-name-repo
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { getIngredientCanonicalizer } from "./ingredient-canonicalizer";

function normalizeNameKey(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, " ");
}

export async function canonicalizeCached(
  rawNames: string[]
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  if (process.env.INGREDIENT_LLM_FALLBACK !== "1" || rawNames.length === 0) {
    return out;
  }

  const unique = [...new Set(rawNames)];
  const keyOf = new Map(unique.map((n) => [n, normalizeNameKey(n)]));
  const keys = [...new Set(keyOf.values())];

  const cached = await prisma.ingredientNameCache.findMany({
    where: { key: { in: keys } },
  });
  const byKey = new Map<string, string | null>(
    cached.map((r) => [r.key, r.canonical])
  );

  const misses = unique.filter((n) => !byKey.has(keyOf.get(n)!));
  if (misses.length > 0) {
    const fresh = await getIngredientCanonicalizer().canonicalize(misses);
    for (const raw of misses) {
      const key = keyOf.get(raw)!;
      const canonical = fresh.has(raw) ? fresh.get(raw)! : null;
      byKey.set(key, canonical);
      await prisma.ingredientNameCache.upsert({
        where: { key },
        create: { key, canonical },
        update: { canonical, lastFetchedAt: new Date() },
      });
    }
  }

  for (const raw of rawNames) {
    out.set(raw, byKey.get(keyOf.get(raw)!) ?? null);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/unit/ingredient-name-repo.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ingredient-name-repo.ts tests/unit/ingredient-name-repo.test.ts
git commit -m "feat(nutrition): add cached ingredient-name canonicalization repo"
```

---

## Task 4: Extract `resolveBatch` (behavior-preserving refactor)

The two-pass fallback needs to re-run the whole per-ingredient resolution for a
subset. Extract today's body of `resolveIngredientMatches` into a reusable
`resolveBatch(parsed)`. This must NOT change behavior — the harness + unit suite
prove it.

**Files:**
- Modify: `src/actions/analyzeRecipe.ts` (`resolveIngredientMatches`, ~lines 273-364)

- [ ] **Step 1: Capture the green baseline**

Run: `bun run test:unit && bun run test:eval:nutrition`
Expected: 731 unit pass; eval 20 pass / 4 skipped. (Baseline to preserve.)

- [ ] **Step 2: Extract `resolveBatch`**

In `src/actions/analyzeRecipe.ts`, rename the existing `resolveIngredientMatches`
body to a new function that takes already-parsed ingredients, and make
`resolveIngredientMatches` parse then delegate. Replace:

```ts
async function resolveIngredientMatches(
  ingredients: string[]
): Promise<ResolvedIngredientMatch[]> {
  const parsed: ParsedIngredient[] = ingredients
    .filter((line) => line.trim().length > 0)
    .map((line) => parseIngredientLine(line));

  const searchResults = await Promise.all(
```

with:

```ts
async function resolveIngredientMatches(
  ingredients: string[]
): Promise<ResolvedIngredientMatch[]> {
  const parsed: ParsedIngredient[] = ingredients
    .filter((line) => line.trim().length > 0)
    .map((line) => parseIngredientLine(line));
  return resolveBatch(parsed);
}

/**
 * Resolve a list of already-parsed ingredients to FDC matches + gram weights:
 * search (cached) → rank → staple pin → batch-fetch → first plausible candidate
 * (staple bypasses the match-quality guard) → resolveGramWeight.
 */
async function resolveBatch(
  parsed: ParsedIngredient[]
): Promise<ResolvedIngredientMatch[]> {
  const searchResults = await Promise.all(
```

Leave the rest of the original body unchanged (it already operates on `parsed`).

- [ ] **Step 3: Run the baseline to prove no behavior change**

Run: `bun run test:unit && bun run test:eval:nutrition`
Expected: identical — 731 unit pass; eval 20 pass / 4 skipped.

- [ ] **Step 4: Commit**

```bash
git add src/actions/analyzeRecipe.ts
git commit -m "refactor(nutrition): extract resolveBatch from resolveIngredientMatches"
```

---

## Task 5: Two-pass LLM fallback in `resolveIngredientMatches`

**Files:**
- Modify: `src/actions/analyzeRecipe.ts` (`resolveIngredientMatches` + import)
- Test: `tests/unit/canonicalizer-fallback.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/fdcRepo", () => ({
  getFoodsCached: vi.fn(),
  searchFoodsCached: vi.fn(),
}));
vi.mock("@/lib/ingredient-name-repo", () => ({
  canonicalizeCached: vi.fn(),
}));

import { type FdcFood } from "@/lib/fdc";
import { getFoodsCached, searchFoodsCached } from "@/lib/fdcRepo";
import { canonicalizeCached } from "@/lib/ingredient-name-repo";
import { analyzeRecipeProfileAction } from "@/actions/analyzeRecipe";

const salmon: FdcFood = {
  fdcId: 173686,
  description: "Fish, salmon, Atlantic, wild, raw",
  dataType: "SR Legacy",
  foodNutrients: [{ nutrientNumber: "208", amount: 142, unitName: "KCAL" }],
};
const junk: FdcFood = {
  fdcId: 999,
  description: "Clif Z bar",
  dataType: "Branded",
  foodNutrients: [{ nutrientNumber: "208", amount: 400, unitName: "KCAL" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(searchFoodsCached).mockImplementation(async (q: string) => {
    if (q.includes("salmon"))
      return [{ fdcId: 173686, description: salmon.description, dataType: "SR Legacy" }];
    return [{ fdcId: 999, description: "Clif Z bar", dataType: "Branded" }];
  });
  vi.mocked(getFoodsCached).mockImplementation(async (ids: number[]) =>
    [salmon, junk].filter((f) => ids.includes(f.fdcId))
  );
});

describe("LLM canonicalization fallback in resolveIngredientMatches", () => {
  it("recovers a no-match via the canonical name (pass 2)", async () => {
    vi.mocked(canonicalizeCached).mockResolvedValue(
      new Map([["łosoś świeży", "salmon"]])
    );
    const r = await analyzeRecipeProfileAction({
      ingredients: ["200 g łosoś świeży"],
      servings: 1,
    });
    expect(r.items[0].fdcId).toBe(173686);
  });

  it("stays a no-match when the fallback yields nothing (flag off → empty map)", async () => {
    vi.mocked(canonicalizeCached).mockResolvedValue(new Map());
    const r = await analyzeRecipeProfileAction({
      ingredients: ["200 g łosoś świeży"],
      servings: 1,
    });
    expect(r.items[0].fdcId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/unit/canonicalizer-fallback.test.ts`
Expected: FAIL — first test gets `fdcId` null (no pass 2 yet); `canonicalizeCached` not wired.

- [ ] **Step 3: Wire the two-pass fallback**

In `src/actions/analyzeRecipe.ts`, add the import near the other lib imports:

```ts
import { canonicalizeCached } from "@/lib/ingredient-name-repo";
```

Then replace the body of `resolveIngredientMatches` (from Task 4) with:

```ts
async function resolveIngredientMatches(
  ingredients: string[]
): Promise<ResolvedIngredientMatch[]> {
  const parsed: ParsedIngredient[] = ingredients
    .filter((line) => line.trim().length > 0)
    .map((line) => parseIngredientLine(line));
  const resolved = await resolveBatch(parsed);

  // LLM fallback (cached, flag-gated inside canonicalizeCached): for ingredients
  // the deterministic pass couldn't match, canonicalize the name and retry the
  // SAME pipeline (search → rank → guard) once with the canonical name.
  const unmatchedIdx = resolved.flatMap((m, i) => (m.food === null ? [i] : []));
  if (unmatchedIdx.length === 0) return resolved;

  const canonical = await canonicalizeCached(
    unmatchedIdx.map((i) => resolved[i].parsed.name)
  );
  const retryIdx = unmatchedIdx.filter((i) => {
    const c = canonical.get(resolved[i].parsed.name);
    return c != null && c.toLowerCase() !== resolved[i].parsed.name.toLowerCase();
  });
  if (retryIdx.length === 0) return resolved;

  const retryParsed = retryIdx.map((i) => ({
    ...resolved[i].parsed,
    name: canonical.get(resolved[i].parsed.name)!,
  }));
  const retried = await resolveBatch(retryParsed);
  retryIdx.forEach((origIdx, k) => {
    if (retried[k].food !== null) resolved[origIdx] = retried[k];
  });
  return resolved;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/unit/canonicalizer-fallback.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full suite — no regression**

Run: `bun run test:unit && bun run test:eval:nutrition`
Expected: unit pass (now 736: 731 + 3 canonicalizer + ... adjust to actual count); eval 20 pass / 4 skipped. The anchor tier and existing behavior are unchanged because `canonicalizeCached` is flag-off by default → empty map → no pass 2.

- [ ] **Step 6: Commit**

```bash
git add src/actions/analyzeRecipe.ts tests/unit/canonicalizer-fallback.test.ts
git commit -m "feat(nutrition): two-pass LLM name-canonicalization fallback"
```

---

## Task 6: Live measurement (manual — needs Vertex creds + USDA)

The unit tests prove the machinery deterministically. This task measures whether
Gemini actually makes the real Polish recipes pass. It hits live Vertex + USDA,
so it runs manually (sandbox disabled), not in CI.

**Files:** none (validation only; may extend `tests/eval/nutrition/record-fixtures.test.ts` — see Step 3)

- [ ] **Step 1: Baseline the real tier (flag off)**

Run: `bun run test:eval:nutrition:real`
Expected: the 3 `pl-d1-*` recipes FAIL (current measurement: chicken etc. are honest no-matches).

- [ ] **Step 2: Re-record fixtures with the flag on so canonical-name searches are captured**

The replay store only has the original Polish-name searches. With canonicalization, pass 2 searches for the English canonical names, which must also be in the store. Re-run the recorder with the flag on:

Run: `INGREDIENT_LLM_FALLBACK=1 bun run eval:nutrition:record` (sandbox disabled)
Expected: recorder canonicalizes the unmatched names, then records USDA searches for BOTH original and canonical names into `recorded-store.json`.

> If the recorder does not yet canonicalize before recording, add that step to `record-fixtures.test.ts`: after collecting parsed names, call `canonicalizeCached(names)` and also search/fetch for the non-null canonical names. (Small, mirrors the two-pass.)

- [ ] **Step 3: Measure with the flag on**

Run: `INGREDIENT_LLM_FALLBACK=1 bun run test:eval:nutrition:real`
Expected: the `pl-d1-*` recipes move toward the `real` tolerance (chicken, salmon, quinoa, etc. now resolve). Record the before/after per-serving numbers.

- [ ] **Step 4: Confirm no regression with the flag both off and on**

Run: `bun run test:unit && bun run test:eval:nutrition`
Then: `INGREDIENT_LLM_FALLBACK=1 bun run test:eval:nutrition`
Expected: both green (anchor unaffected — its ingredients all match deterministically, so pass 2 never fires).

- [ ] **Step 5: Document the result + decide promotion**

Update `.agent/System/nutrition_units.md` with the measured improvement. If the real tier is reliably green with the flag on, plan promoting it to the CI gate (requires the recorded canonical fixtures from Step 2 committed so CI is deterministic, and `canonicalizeCached` mocked/replayed in the real runner). Commit doc + fixtures.

---

## Self-review

- **Spec coverage:** canonicalizer (Task 2) ✓, cache+flag (Task 3) ✓, `IngredientNameCache` model+migration (Task 1) ✓, two-pass hook (Tasks 4-5) ✓, guard still applies (pass 2 reuses `resolveBatch` which calls `matchPlausible`) ✓, measurement via harness (Task 6) ✓, flag-gated rollout ✓, out-of-scope respected (no fdcId selection, no gram resolution by LLM) ✓.
- **Type consistency:** `canonicalize(rawNames): Map<string,string|null>` (Task 2) == used by `canonicalizeCached` (Task 3) == mocked in Task 5. `resolveBatch(parsed: ParsedIngredient[])` (Task 4) == called in Task 5. `IngredientNameCache.{key,canonical,lastFetchedAt}` (Task 1) == prisma calls in Task 3.
- **Placeholders:** none — every code/command step is concrete. (Task 5 Step 5 unit count says "adjust to actual" — that is an expected-count note, not a code placeholder.)
- **Scope:** single feature, one plan.
