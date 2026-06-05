import { describe, it, expect } from "vitest";

import en from "../../messages/en.json";
import es from "../../messages/es.json";
import pl from "../../messages/pl.json";

/**
 * Translation parity test for the `chat.*` namespace (DIE-38 AC).
 *
 * Locks the contract that every key referenced by the runtime / guardrails /
 * UI exists in every locale. Missing keys become next-intl "key.not.found"
 * errors at render time; this test catches them at build time.
 */

function collectKeyPaths(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) {
    return [prefix];
  }
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${k}` : k;
    out.push(...collectKeyPaths(v, next));
  }
  return out;
}

const enChat = (en as { chat: unknown }).chat;
const esChat = (es as { chat: unknown }).chat;
const plChat = (pl as { chat: unknown }).chat;

const enKeys = collectKeyPaths(enChat).sort();
const esKeys = collectKeyPaths(esChat).sort();
const plKeys = collectKeyPaths(plChat).sort();

describe("messages/{en,es,pl}.json — chat.* namespace parity", () => {
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

  it.each([
    "placeholder",
    "empty.title",
    "proGate.title",
    "proGate.cta",
    "toolError.generic",
    "toolError.quotaExceeded",
    "guardrail.nutritionRedacted",
    "guardrail.medicalAdvice",
    "costCap.reached",
  ] as const)("required key %s is present in every locale", (k) => {
    expect(enKeys).toContain(k);
    expect(esKeys).toContain(k);
    expect(plKeys).toContain(k);
  });
});
