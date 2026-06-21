/**
 * FDC search-candidate ranking.
 *
 * Pure logic for ordering the foods USDA search returns for one ingredient,
 * extracted from the recipe-analysis server action so it can be unit-tested in
 * isolation. Ranks by USDA data-type priority first, then name relevance as a
 * tiebreak, so the analyzer can walk candidates best-first and fall back when a
 * higher-ranked food can't be fetched.
 *
 * @module lib/fdc-match
 */

import { DATATYPE_PRIORITY, type FdcSearchFood } from "./fdc";

/**
 * Qualifier words that narrow an ingredient to a part/derivative the query
 * didn't ask for. A candidate carrying one the query lacks is down-ranked, so
 * "egg" prefers whole egg over "egg white" / "egg substitute" / "egg powder".
 */
const NARROWING_QUALIFIERS = [
  // parts / derivatives / processed forms
  "white",
  "yolk",
  "substitute",
  "powder",
  "powdered",
  "dried",
  "concentrate",
  "imitation",
  "flavored",
  "flavoured",
  // prepared dishes — a raw ingredient query ("egg", "chicken") should not
  // match a composed dish ("Egg, Benedict", "Chicken, casserole").
  "benedict",
  "deviled",
  "scrambled",
  "omelet",
  "omelette",
  "souffle",
  "quiche",
  "casserole",
  "sandwich",
  "wrap",
  "stuffed",
  "breaded",
];

/**
 * Match-quality guard. A non-staple candidate is only plausible if the
 * description shares at least one content token (≥3 chars, substring-tolerant
 * for plurals) with the query name. Catches the catastrophic class where an
 * untranslated/unknown name falls through to free-text search and the only USDA
 * candidates are unrelated branded products (e.g. "mięso z piersi kurczaka" →
 * "Clif Z bar" at confidence 1.0). Returning no match (flagged) is more honest
 * than silently using the wrong food.
 *
 * Deliberately lenient — short stopword tokens are dropped so an incidental
 * 1-letter overlap ("z" in "Clif Z bar") doesn't count, and matching is
 * substring-based so "tomato" still matches "Tomatoes". Staple matches are
 * trusted and must bypass this check.
 */
export function matchPlausible(description: string, queryName: string): boolean {
  const desc = description.toLowerCase();
  const tokens = queryName
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  if (tokens.length === 0) return true; // nothing substantive to check
  return tokens.some((t) => desc.includes(t));
}

function dataTypePriority(dataType: string): number {
  const i = DATATYPE_PRIORITY.indexOf(
    dataType as (typeof DATATYPE_PRIORITY)[number]
  );
  return i === -1 ? 999 : i;
}

function hasWord(haystack: string, word: string): boolean {
  return new RegExp(
    `\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`
  ).test(haystack);
}

/**
 * Relevance score for a candidate against the query — LOWER is a closer match.
 * Combines two signals:
 *  - query tokens NOT found in the description (the food doesn't cover what was
 *    asked for), plus
 *  - narrowing qualifiers in the description the query didn't ask for (the food
 *    is a part/derivative, e.g. "egg white" for "egg").
 */
function relevanceScore(description: string, queryTokens: string[]): number {
  const desc = description.toLowerCase();
  const unmatched = queryTokens.filter((t) => !hasWord(desc, t)).length;
  let qualifierPenalty = 0;
  for (const q of NARROWING_QUALIFIERS) {
    if (!queryTokens.includes(q) && hasWord(desc, q)) qualifierPenalty += 1;
  }
  return unmatched + qualifierPenalty;
}

/**
 * Rank FDC search candidates best-first: USDA data-type priority
 * (Foundation > Survey (FNDDS) > SR Legacy > Branded) first, then name
 * relevance as a tiebreak within the same data type.
 *
 * @param foods - search results for one ingredient
 * @param queryName - the parsed ingredient name that was searched
 * @returns a new array sorted best-first
 */
export function rankMatches(
  foods: FdcSearchFood[],
  queryName: string
): FdcSearchFood[] {
  const queryTokens = queryName.toLowerCase().split(/\s+/).filter(Boolean);
  return [...foods].sort((a, b) => {
    const pa = dataTypePriority(a.dataType);
    const pb = dataTypePriority(b.dataType);
    if (pa !== pb) return pa - pb;
    return (
      relevanceScore(a.description, queryTokens) -
      relevanceScore(b.description, queryTokens)
    );
  });
}
