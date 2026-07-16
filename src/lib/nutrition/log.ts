/**
 * Structured logging for the nutrition pipeline.
 *
 * One logger per analysis carries a short **correlation id**, so every line a
 * single recipe emits — across the action, the resolver, and the stages — can be
 * grepped together even when requests interleave on a busy server. Replaces the
 * ad-hoc `console.log` scattered through the pipeline.
 *
 * Levels (env `NUTRITION_LOG_LEVEL`, default `info`):
 *   - `silent` — nothing (tests set this).
 *   - `info`   — recipe entry, cache hit, completion + coverage + timing.
 *   - `debug`  — the per-ingredient resolution trace: canonicalization, food
 *     selection, gram strategy, Stage-2 decisions. Turn this on in production to
 *     see exactly why a recipe resolved the way it did.
 *
 * @module lib/nutrition/log
 */

export type NutritionLogLevel = "silent" | "info" | "debug";

const RANK: Record<NutritionLogLevel, number> = {
  silent: 0,
  info: 1,
  debug: 2,
};

function configuredLevel(): NutritionLogLevel {
  const raw = (process.env.NUTRITION_LOG_LEVEL ?? "info").toLowerCase();
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

export interface NutritionLogger {
  /** The correlation id stamped on every line from this analysis. */
  readonly id: string;
  info(msg: string, fields?: Record<string, unknown>): void;
  debug(msg: string, fields?: Record<string, unknown>): void;
}

/**
 * Create a logger bound to a fresh correlation id for one analysis. The level is
 * read once from the environment at creation.
 */
export function createNutritionLogger(label = "nutrition"): NutritionLogger {
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
