/**
 * Markdown → ImportedRecipe heuristic parser (DIE-35 web strategy).
 *
 * Used when `selectIngestStrategy` routes a URL to `supadata-web` and the
 * Supadata `/web/scrape` endpoint returns markdown content. This is a v1
 * tracer-bullet parser: it looks for canonical "Ingredients" and
 * "Instructions/Directions/Method/Steps/Preparation" section headers,
 * extracts the following list items, and pairs them with the page's
 * `name` / `description` metadata returned by Supadata.
 *
 * If the parser cannot recover at least a title and one ingredient, callers
 * must surface `tool.failed { reason: "no-ingredients" }`. There is no
 * Browser-Use fallback (Decisión 8) — partial success requires the
 * minimum viable recipe shape.
 */

import type { ImportedRecipe, Ingredient } from "@/types/recipe";
import type { ScrapeResult } from "@/lib/supadata";

const INGREDIENTS_HEADER = /^\s*#{1,6}\s*ingredients?\s*$/im;
const INSTRUCTIONS_HEADER =
  /^\s*#{1,6}\s*(instructions?|directions?|method|steps|preparation|how to make.*)\s*$/im;
const LIST_ITEM = /^\s*(?:[-*+]|\d+\.)\s+(.+?)\s*$/;

/** Single ingredient line parser. Falls back to whole string as the name. */
function parseIngredientLine(line: string): Ingredient {
  // "2 cups flour", "1.5 tbsp olive oil", "200 g sugar"
  const match = line.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?\s+(.+)$/);
  if (match) {
    const amount = parseFloat(match[1].replace(",", "."));
    const unit = (match[2] ?? "unit").trim();
    const name = match[3].trim();
    if (!Number.isNaN(amount) && name.length > 0) {
      return { name, amount, unit };
    }
  }
  return { name: line.trim(), amount: 1, unit: "unit" };
}

function extractSectionItems(
  markdown: string,
  headerRegex: RegExp
): string[] {
  const lines = markdown.split(/\r?\n/);
  const headerIdx = lines.findIndex((line) => headerRegex.test(line));
  if (headerIdx === -1) return [];

  const items: string[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    // Stop on the next markdown header — section ends.
    if (/^\s*#{1,6}\s+/.test(line)) break;
    const m = line.match(LIST_ITEM);
    if (m) {
      items.push(m[1].trim());
      continue;
    }
    // Skip blank lines but keep collecting if we already have items.
    if (line.trim() === "") continue;
    // Non-list, non-empty line after at least one collected item: end the section.
    if (items.length > 0) break;
  }
  return items;
}

export function parseRecipeFromScrape(
  scrape: ScrapeResult,
  sourceUrl: string
): ImportedRecipe {
  const markdown = scrape.content ?? "";
  const ingredientLines = extractSectionItems(markdown, INGREDIENTS_HEADER);
  const instructions = extractSectionItems(markdown, INSTRUCTIONS_HEADER);

  const title =
    (scrape.name && scrape.name.trim()) ||
    (markdown.match(/^\s*#\s+(.+?)\s*$/m)?.[1].trim() ?? "");

  return {
    title,
    description: scrape.description?.trim() || undefined,
    ingredients: ingredientLines.map(parseIngredientLine),
    instructions,
    sourceUrl,
    extractedAt: new Date().toISOString(),
  };
}
