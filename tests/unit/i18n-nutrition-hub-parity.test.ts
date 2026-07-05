import { describe, it, expect } from "vitest";

import en from "../../messages/en.json";
import es from "../../messages/es.json";
import pl from "../../messages/pl.json";

import { ENCYCLOPEDIA } from "@/lib/nutrients/encyclopedia";
import { ALL_NUTRIENT_KEYS } from "@/lib/nutrients/registry";

/**
 * Translation parity for the Nutrition Hub namespaces. Modeled on
 * i18n-chat-parity.test.ts — missing keys become next-intl render-time
 * errors; this catches them at build time.
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

type Messages = Record<string, unknown>;

function namespaceKeys(messages: Messages, namespace: string): string[] {
  const node = namespace
    .split(".")
    .reduce<unknown>(
      (acc, part) => (acc as Messages | undefined)?.[part as never],
      messages
    );
  return collectKeyPaths(node).sort();
}

const NAMESPACES = [
  "nutritionHub",
  "nutrition.calculator",
  "chat.seeds.nutritionHub",
];

describe.each(NAMESPACES)("messages parity — %s.*", (namespace) => {
  const enKeys = namespaceKeys(en as Messages, namespace);
  const esKeys = namespaceKeys(es as Messages, namespace);
  const plKeys = namespaceKeys(pl as Messages, namespace);

  it("Spanish covers the same keypaths as English", () => {
    const missing = enKeys.filter((k) => !esKeys.includes(k));
    const extra = esKeys.filter((k) => !enKeys.includes(k));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it("Polish covers the same keypaths as English", () => {
    const missing = enKeys.filter((k) => !plKeys.includes(k));
    const extra = plKeys.filter((k) => !enKeys.includes(k));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });
});

describe("content completeness", () => {
  const hub = (en as Messages).nutritionHub as Messages;

  it("every registry nutrient has a display name", () => {
    const names = hub.nutrients as Record<string, { name?: string }>;
    for (const key of ALL_NUTRIENT_KEYS) {
      expect(names[key]?.name, key).toBeTruthy();
    }
  });

  it("every encyclopedia slug has its prose fields", () => {
    const encyclopedia = hub.encyclopedia as Record<
      string,
      Record<string, string>
    >;
    for (const entry of ENCYCLOPEDIA) {
      const content = encyclopedia[entry.slug];
      expect(content, entry.slug).toBeDefined();
      for (const field of ["tagline", "whatItDoes", "whyYouCare", "funFact"]) {
        expect(content[field], `${entry.slug}.${field}`).toBeTruthy();
      }
    }
  });
});
