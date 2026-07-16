/**
 * Structured logging for the recipe-import (ingest) pipeline.
 *
 * Mirrors the nutrition logger ([`@/lib/nutrition/log`](../nutrition/log.ts)):
 * one logger per import carries a short **correlation id**, so the scrape line
 * and the LLM-extraction line of a single import can be grepped together even
 * when imports interleave on a busy server.
 *
 * Levels (env `INGEST_LOG_LEVEL`, default `info`):
 *   - `silent` — nothing (tests set this).
 *   - `info`   — strategy, scrape summary (chars + whether an ingredients
 *     section was captured), extraction summary (count + how many amounts are 0).
 *   - `debug`  — the full scraped markdown and the raw per-ingredient output, so
 *     you can see EXACTLY what Supadata returned and what the LLM made of it.
 *
 * @module lib/ingest/log
 */

export type IngestLogLevel = "silent" | "info" | "debug";

const RANK: Record<IngestLogLevel, number> = { silent: 0, info: 1, debug: 2 };

function configuredLevel(): IngestLogLevel {
  const raw = (process.env.INGEST_LOG_LEVEL ?? "info").toLowerCase();
  return raw === "silent" || raw === "debug" ? raw : "info";
}

let seq = 0;

/** Short, monotonic-ish correlation id (base36) — readable, collision-tolerant. */
function nextId(): string {
  seq = (seq + 1) % 46656; // 36^3
  const rand = Math.floor(Math.random() * 46656);
  return seq.toString(36).padStart(3, "0") + rand.toString(36).padStart(3, "0");
}

/** Format structured fields as a compact `key=value` tail; drops undefined. */
function fmt(fields?: Record<string, unknown>): string {
  if (!fields) return "";
  const parts = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`);
  return parts.length ? ` ${parts.join(" ")}` : "";
}

export interface IngestLogger {
  /** The correlation id stamped on every line from this import. */
  readonly id: string;
  info(msg: string, fields?: Record<string, unknown>): void;
  debug(msg: string, fields?: Record<string, unknown>): void;
}

/**
 * Create a logger bound to a fresh correlation id for one import. The level is
 * read once from the environment at creation.
 */
export function createIngestLogger(label = "import"): IngestLogger {
  const id = nextId();
  const level = configuredLevel();
  const emit = (
    lvl: "info" | "debug",
    msg: string,
    fields?: Record<string, unknown>
  ) => {
    if (RANK[level] < RANK[lvl]) return;
    console.log(`[${label} ${id}] ${msg}${fmt(fields)}`);
  };
  return {
    id,
    info: (m, f) => emit("info", m, f),
    debug: (m, f) => emit("debug", m, f),
  };
}

/**
 * Summarize an extracted ingredient list for a log line: how many there are and
 * how many came back with a missing/zero amount (the symptom of an incomplete
 * scrape — the extractor saw the name but no quantity).
 */
export function summarizeIngredients(
  ingredients: ReadonlyArray<{ amount?: number | string | null }>
): { count: number; zeroAmount: number } {
  let zeroAmount = 0;
  for (const ing of ingredients) {
    const n = typeof ing.amount === "string" ? Number(ing.amount) : ing.amount;
    if (!n || !Number.isFinite(n)) zeroAmount += 1;
  }
  return { count: ingredients.length, zeroAmount };
}
