/**
 * Unit Registry — the single source of truth for measurement units.
 *
 * Every other module that needs to understand a unit (normalization, kind
 * classification, base-unit conversion, the recipe-form dropdown) derives from
 * this one table. Before this module the codebase carried THREE divergent unit
 * vocabularies (`ingredients.ts`, `gram-resolution.ts`, `shopping-item-transformer.ts`)
 * that disagreed on `stick`, `bar`, `fl oz`, and locale spellings.
 *
 * What this module knows: a unit's identity (canonical form + every alias across
 * en/es/pl), its kind (weight/volume/count), and its GENERIC conversion to a base
 * unit (grams for weight, millilitres for volume). What it deliberately does NOT
 * know: ingredient-specific density (e.g. "1 cup flour = 120 g") — that stays in
 * `DENSITY_FALLBACK_G_PER_UNIT`, a separate concern.
 *
 * @module lib/unit-registry
 */

export type UnitKind = "weight" | "volume" | "count";

export interface UnitDefinition {
  /** Canonical key the rest of the system uses (e.g. "tbsp"). */
  canonical: string;
  /** Whether this unit measures weight, volume, or a countable item. */
  kind: UnitKind;
  /**
   * Generic conversion to the kind's base unit: grams for weight, millilitres
   * for volume. `null` for count units (a "piece" has no universal weight).
   */
  toBase: number | null;
  /** Every spelling/abbreviation (en/es/pl) that normalizes to `canonical`. */
  aliases: readonly string[];
  /** Whether the recipe-form unit dropdown offers this unit. */
  selectable: boolean;
}

/**
 * The canonical unit table. Ordering of selectable units here is the ordering
 * the dropdown renders (grouped weight → volume → count).
 */
export const UNIT_DEFINITIONS: readonly UnitDefinition[] = [
  // --- Weight (base: grams) ---
  {
    canonical: "g",
    kind: "weight",
    toBase: 1,
    selectable: true,
    aliases: ["gram", "grams", "gr", "gramo", "gramos", "gramy", "gramów"],
  },
  {
    canonical: "kg",
    kind: "weight",
    toBase: 1000,
    selectable: true,
    aliases: [
      "kilogram", "kilograms", "kilo", "kilos",
      "kilogramo", "kilogramos", "kilogramy", "kilogramów",
    ],
  },
  {
    canonical: "oz",
    kind: "weight",
    toBase: 28.3495,
    selectable: true,
    aliases: ["ounce", "ounces", "onza", "onzas", "uncja", "uncje", "uncji"],
  },
  {
    canonical: "lb",
    kind: "weight",
    toBase: 453.592,
    selectable: true,
    aliases: ["pound", "pounds", "lbs", "libra", "libras", "funt", "funty", "funtów"],
  },

  // --- Volume (base: millilitres) ---
  {
    canonical: "ml",
    kind: "volume",
    toBase: 1,
    selectable: true,
    aliases: [
      "milliliter", "milliliters", "millilitre", "millilitres",
      "mililitro", "mililitros", "mililitr", "mililitry", "mililitrów",
    ],
  },
  {
    canonical: "l",
    kind: "volume",
    toBase: 1000,
    selectable: true,
    aliases: ["liter", "liters", "litre", "litres", "litro", "litros", "litr", "litry", "litrów"],
  },
  {
    canonical: "tsp",
    kind: "volume",
    toBase: 4.929,
    selectable: true,
    aliases: [
      "teaspoon", "teaspoons", "cucharadita", "cucharaditas",
      "łyżeczka", "łyżeczki", "łyżeczek",
    ],
  },
  {
    canonical: "tbsp",
    kind: "volume",
    toBase: 14.787,
    selectable: true,
    aliases: [
      "tablespoon", "tablespoons", "tbs", "tbl",
      "cucharada", "cucharadas", "łyżka", "łyżki", "łyżek",
    ],
  },
  {
    canonical: "cup",
    kind: "volume",
    toBase: 236.588,
    selectable: true,
    aliases: ["cups", "c", "taza", "tazas", "szklanka", "szklanki", "szklanek"],
  },
  {
    canonical: "fl oz",
    kind: "volume",
    toBase: 29.574,
    selectable: true,
    aliases: ["fluid ounce", "fluid ounces", "fl. oz"],
  },
  // Parseable but kept out of the dropdown to avoid clutter.
  { canonical: "pint", kind: "volume", toBase: 473.176, selectable: false, aliases: ["pints"] },
  { canonical: "quart", kind: "volume", toBase: 946.353, selectable: false, aliases: ["quarts"] },
  { canonical: "gallon", kind: "volume", toBase: 3785.41, selectable: false, aliases: ["gallons"] },

  // --- Count (no universal base weight) ---
  {
    canonical: "piece",
    kind: "count",
    toBase: null,
    selectable: true,
    aliases: [
      "pieces", "pc", "pcs", "whole", "item", "items", "unit", "units",
      "pieza", "piezas", "unidad", "unidades", "entero", "enteros",
      "sztuka", "sztuki", "sztuk", "kawałek", "kawałki", "kawałków", "całość",
    ],
  },
  {
    canonical: "clove",
    kind: "count",
    toBase: null,
    selectable: true,
    aliases: ["cloves", "diente", "dientes", "ząbek", "ząbki", "ząbków"],
  },
  {
    canonical: "slice",
    kind: "count",
    toBase: null,
    selectable: true,
    aliases: ["slices", "rebanada", "rebanadas", "plaster", "plastry", "plastrów"],
  },
  {
    canonical: "can",
    kind: "count",
    toBase: null,
    selectable: true,
    aliases: ["cans", "lata", "latas", "puszka", "puszki", "puszek"],
  },
  {
    canonical: "package",
    kind: "count",
    toBase: null,
    selectable: true,
    aliases: [
      "packages", "pkg", "paquete", "paquetes",
      "opakowanie", "opakowania", "opakowań",
    ],
  },
  {
    canonical: "bunch",
    kind: "count",
    toBase: null,
    selectable: true,
    aliases: ["bunches", "manojo", "manojos", "pęczek", "pęczki", "pęczków"],
  },
  {
    canonical: "pinch",
    kind: "count",
    toBase: null,
    selectable: true,
    aliases: [
      "pinches", "pizca", "pizcas",
      "szczypta", "szczyptę", "szczypty", "szczypt",
    ],
  },
  // Parseable but not offered in the dropdown.
  { canonical: "box", kind: "count", toBase: null, selectable: false, aliases: ["boxes", "caja", "cajas", "pudełko", "pudełka", "pudełek"] },
  { canonical: "dash", kind: "count", toBase: null, selectable: false, aliases: ["dashes"] },
  { canonical: "stick", kind: "count", toBase: null, selectable: false, aliases: ["sticks"] },
];

/** canonical → definition. */
const BY_CANONICAL = new Map<string, UnitDefinition>(
  UNIT_DEFINITIONS.map((d) => [d.canonical, d])
);

/** alias OR canonical → canonical (built once at module load). */
const ALIAS_TO_CANONICAL = new Map<string, string>();
for (const def of UNIT_DEFINITIONS) {
  ALIAS_TO_CANONICAL.set(def.canonical, def.canonical);
  for (const alias of def.aliases) ALIAS_TO_CANONICAL.set(alias, def.canonical);
}

/**
 * Clean a raw unit string for lookup: lowercase, trim, drop a trailing period,
 * and collapse internal whitespace so "fl. oz", "FL OZ", "fl  oz" all match.
 */
function clean(raw: string): string {
  return raw.toLowerCase().trim().replace(/\.$/, "").replace(/\s+/g, " ");
}

/**
 * Resolve any spelling/alias to its canonical unit. Unknown units pass through
 * cleaned (so downstream code can still attempt a density-table or last-resort
 * match) — this mirrors the permissive behavior the parser relied on.
 */
export function normalizeUnit(raw: string): string {
  const cleaned = clean(raw);
  return ALIAS_TO_CANONICAL.get(cleaned) ?? cleaned;
}

/** Look up the full definition for any spelling, or `null` if unknown. */
export function getUnitDefinition(raw: string): UnitDefinition | null {
  return BY_CANONICAL.get(normalizeUnit(raw)) ?? null;
}

/** Weight / volume / count, or "other" for unrecognized units. */
export function getUnitKind(raw: string): UnitKind | "other" {
  return getUnitDefinition(raw)?.kind ?? "other";
}

/**
 * Convert an amount to the kind's base unit. Returns grams for weight units and
 * millilitres for volume units; `null` for count or unknown units (no universal
 * conversion exists).
 */
export function toBaseAmount(
  amount: number,
  raw: string
): { amount: number; base: "g" | "ml" } | null {
  const def = getUnitDefinition(raw);
  if (!def || def.toBase === null) return null;
  return {
    amount: amount * def.toBase,
    base: def.kind === "weight" ? "g" : "ml",
  };
}

/** Canonical units offered by the recipe-form dropdown, in render order. */
export const SELECTABLE_UNITS: readonly string[] = UNIT_DEFINITIONS.filter(
  (d) => d.selectable
).map((d) => d.canonical);
