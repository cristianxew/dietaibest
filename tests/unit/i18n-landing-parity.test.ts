import { describe, it, expect } from "vitest";

import en from "../../messages/en.json";
import es from "../../messages/es.json";
import pl from "../../messages/pl.json";

/**
 * Translation parity test for the `landing.*` namespace.
 *
 * The marketing landing is the first page every visitor sees, in all three
 * locales. A missing key renders "landing.key.not.found" in the hero; a
 * dropped `{days}` placeholder silently advertises the wrong trial length.
 */
function collectEntries(obj: unknown, prefix = ""): [string, unknown][] {
  if (typeof obj !== "object" || obj === null) {
    return [[prefix, obj]];
  }
  const out: [string, unknown][] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${k}` : k;
    out.push(...collectEntries(v, next));
  }
  return out;
}

const enEntries = new Map(collectEntries((en as { landing: unknown }).landing));
const esEntries = new Map(collectEntries((es as { landing: unknown }).landing));
const plEntries = new Map(collectEntries((pl as { landing: unknown }).landing));

const enKeys = [...enEntries.keys()].sort();
const esKeys = [...esEntries.keys()].sort();
const plKeys = [...plEntries.keys()].sort();

/** ICU arguments (`{days}`, `{value, number}` → `value`) used by a message. */
function placeholders(message: unknown): string[] {
  if (typeof message !== "string") return [];
  return [...message.matchAll(/\{\s*([a-zA-Z0-9_]+)/g)].map((m) => m[1]).sort();
}

/** Rich-text tags (`<em>`, `<strong>`) used by a message. */
function tags(message: unknown): string[] {
  if (typeof message !== "string") return [];
  return [...message.matchAll(/<([a-z]+)>/g)].map((m) => m[1]).sort();
}

describe("messages/{en,es,pl}.json — landing.* namespace parity", () => {
  it("English defines the landing namespace", () => {
    expect(enKeys.length).toBeGreaterThan(0);
  });

  it("Spanish translations cover the same keypaths as English", () => {
    const missing = enKeys.filter((k) => !esKeys.includes(k));
    const extra = esKeys.filter((k) => !enKeys.includes(k));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it("Polish translations cover the same keypaths as English", () => {
    const missing = enKeys.filter((k) => !plKeys.includes(k));
    const extra = plKeys.filter((k) => !enKeys.includes(k));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it("every string with {days} in English keeps it in Spanish and Polish", () => {
    const withDays = enKeys.filter((k) => String(enEntries.get(k)).includes("{days}"));
    expect(withDays.length).toBeGreaterThan(0);

    const broken = withDays.flatMap((k) => [
      ...(String(esEntries.get(k)).includes("{days}") ? [] : [`es:${k}`]),
      ...(String(plEntries.get(k)).includes("{days}") ? [] : [`pl:${k}`]),
    ]);
    expect(broken).toEqual([]);
  });

  it("keeps the same ICU arguments and rich-text tags in every locale", () => {
    const mismatched = enKeys.flatMap((k) => {
      const expected = JSON.stringify([placeholders(enEntries.get(k)), tags(enEntries.get(k))]);
      return [
        ["es", esEntries.get(k)] as const,
        ["pl", plEntries.get(k)] as const,
      ]
        .filter(([, v]) => JSON.stringify([placeholders(v), tags(v)]) !== expected)
        .map(([locale]) => `${locale}:${k}`);
    });
    expect(mismatched).toEqual([]);
  });
});
