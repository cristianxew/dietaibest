#!/usr/bin/env bun
/* eslint-disable no-console */

/**
 * DIE-41 quality eval — Gemma 4 31B recipe-from-image extraction.
 *
 * Manual harness (NOT run in CI). Required before flipping
 * FEATURE_MULTIMODAL_IMPORT=true in prod. Reads every
 *   tests/eval/fixtures/recipe-images/<name>.<ext>
 * paired with
 *   tests/eval/fixtures/recipe-images/<name>.golden.json
 * runs GemmaProvider.extractRecipe, and reports per-item + aggregate match
 * rates against the golden expectations.
 *
 * Pass criteria (locked in engram decision #115):
 *   - ingredients name match >= 80%
 *   - ingredient quantity match >= 70%
 *
 * Usage:
 *   GEMINI_API_KEY=... bun run tests/eval/gemma-image-import.ts
 *
 * Add fixtures by following tests/eval/fixtures/recipe-images/README.md.
 */

import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

import { GemmaProvider } from "@/lib/chat/llm-gemma";
import type { ImportedRecipeData } from "@/lib/ingest/imported-recipe-schema";

const FIXTURES_DIR = "tests/eval/fixtures/recipe-images";
const PASS_INGREDIENT_PCT = 80;
const PASS_QUANTITY_PCT = 70;

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
};

interface GoldenRecipe {
  title: string;
  ingredients: Array<{ name: string; amount: number; unit: string }>;
}

interface ItemResult {
  name: string;
  ingredientsMatched: number;
  ingredientsTotal: number;
  quantitiesMatched: number;
  quantitiesTotal: number;
  error?: string;
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-záéíóúñü0-9 ]/g, "")
    .replace(/\s+/g, " ");
}

function looselyEqualName(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b);
}

function quantitiesMatch(
  expected: { amount: number; unit: string },
  actual: { amount: number; unit?: string }
): boolean {
  if (normalizeName(expected.unit) !== normalizeName(actual.unit || "")) return false;
  // 5% tolerance for amount — Gemma may round.
  const tol = Math.max(Math.abs(expected.amount) * 0.05, 0.01);
  return Math.abs(expected.amount - actual.amount) <= tol;
}

function scoreItem(
  golden: GoldenRecipe,
  extracted: ImportedRecipeData
): ItemResult {
  let ingredientsMatched = 0;
  let quantitiesMatched = 0;
  for (const expected of golden.ingredients) {
    const match = extracted.ingredients.find((i) =>
      looselyEqualName(i.name, expected.name)
    );
    if (match) {
      ingredientsMatched += 1;
      if (quantitiesMatch(expected, match)) quantitiesMatched += 1;
    }
  }
  return {
    name: golden.title,
    ingredientsMatched,
    ingredientsTotal: golden.ingredients.length,
    quantitiesMatched,
    quantitiesTotal: golden.ingredients.length,
  };
}

async function loadFixtures(): Promise<
  Array<{ name: string; mime: string; bytes: Uint8Array; golden: GoldenRecipe }>
> {
  const entries = await readdir(FIXTURES_DIR);
  const out: Array<{
    name: string;
    mime: string;
    bytes: Uint8Array;
    golden: GoldenRecipe;
  }> = [];
  for (const entry of entries) {
    if (!entry.endsWith(".golden.json")) continue;
    const stem = entry.replace(/\.golden\.json$/, "");
    const golden: GoldenRecipe = JSON.parse(
      await readFile(join(FIXTURES_DIR, entry), "utf8")
    );
    const image = entries.find(
      (e) => e !== entry && e.startsWith(`${stem}.`) && e in MIME_BY_EXT
        ? false
        : e !== entry && e.startsWith(`${stem}.`)
    );
    if (!image) {
      console.warn(`[eval] no image found for ${stem} — skipping`);
      continue;
    }
    const ext = extname(image).toLowerCase();
    const mime = MIME_BY_EXT[ext];
    if (!mime) {
      console.warn(`[eval] unsupported extension ${ext} for ${stem} — skipping`);
      continue;
    }
    const bytes = new Uint8Array(await readFile(join(FIXTURES_DIR, image)));
    out.push({ name: stem, mime, bytes, golden });
  }
  return out;
}

async function main(): Promise<void> {
  if (!process.env.GEMINI_API_KEY) {
    console.error("[eval] GEMINI_API_KEY is not set — aborting");
    process.exit(2);
  }

  const fixtures = await loadFixtures();
  if (fixtures.length === 0) {
    console.error(
      `[eval] no fixtures found in ${FIXTURES_DIR} — see README.md for how to add them`
    );
    process.exit(2);
  }

  console.log(`[eval] running ${fixtures.length} fixtures…`);

  const provider = new GemmaProvider();
  const results: ItemResult[] = [];

  for (const fx of fixtures) {
    try {
      const extracted = await provider.extractRecipe({
        imageBytes: fx.bytes,
        mimeType: fx.mime,
      });
      const result = scoreItem(fx.golden, extracted);
      console.log(
        `  ${fx.name.padEnd(40)} ingredients ${result.ingredientsMatched}/${result.ingredientsTotal}  quantities ${result.quantitiesMatched}/${result.quantitiesTotal}`
      );
      results.push(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ${fx.name.padEnd(40)} ERROR: ${message}`);
      results.push({
        name: fx.name,
        ingredientsMatched: 0,
        ingredientsTotal: fx.golden.ingredients.length,
        quantitiesMatched: 0,
        quantitiesTotal: fx.golden.ingredients.length,
        error: message,
      });
    }
  }

  const totalIngredients = results.reduce((s, r) => s + r.ingredientsTotal, 0);
  const matchedIngredients = results.reduce(
    (s, r) => s + r.ingredientsMatched,
    0
  );
  const totalQuantities = results.reduce((s, r) => s + r.quantitiesTotal, 0);
  const matchedQuantities = results.reduce(
    (s, r) => s + r.quantitiesMatched,
    0
  );

  const ingredientPct =
    totalIngredients === 0 ? 0 : (matchedIngredients * 100) / totalIngredients;
  const quantityPct =
    totalQuantities === 0 ? 0 : (matchedQuantities * 100) / totalQuantities;

  console.log("");
  console.log(`Aggregate:`);
  console.log(
    `  ingredients ${matchedIngredients}/${totalIngredients}  ${ingredientPct.toFixed(1)}%  (bar ${PASS_INGREDIENT_PCT}%)`
  );
  console.log(
    `  quantities  ${matchedQuantities}/${totalQuantities}  ${quantityPct.toFixed(1)}%  (bar ${PASS_QUANTITY_PCT}%)`
  );

  const pass =
    ingredientPct >= PASS_INGREDIENT_PCT && quantityPct >= PASS_QUANTITY_PCT;
  console.log("");
  console.log(pass ? "PASS — safe to flip FEATURE_MULTIMODAL_IMPORT=true" : "FAIL — iterate prompt or model");
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
