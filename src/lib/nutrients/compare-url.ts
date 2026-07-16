/**
 * URL codec for shareable comparisons: ?a=fdc:171705&b=recipe:<uuid>.
 * Pure module — the server action re-validates with zod; this only
 * guards against garbage in the query string.
 *
 * @module lib/nutrients/compare-url
 */

import type { ItemRef } from "@/actions/nutrition-hub";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseItemRef(raw: string | undefined | null): ItemRef | null {
  if (!raw) return null;

  const [type, id] = raw.split(":", 2);

  if (type === "fdc") {
    const num = Number(id);
    if (Number.isInteger(num) && num > 0) return { type: "fdc", id: num };
    return null;
  }

  if (type === "recipe" && id && UUID_RE.test(id)) {
    return { type: "recipe", id };
  }

  return null;
}

export function serializeItemRef(ref: ItemRef): string {
  return `${ref.type}:${ref.id}`;
}
