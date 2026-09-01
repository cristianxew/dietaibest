import { describe, it, expect } from "vitest";

import en from "../../messages/en.json";
import es from "../../messages/es.json";
import pl from "../../messages/pl.json";

/**
 * Repo-wide translation parity across every namespace.
 *
 * The namespace-scoped parity tests (auth, chat, nutrition hub) predate this
 * one and cover 3 of the 20 top-level namespaces; a key added to en.json
 * anywhere else used to reach production untested and render as a raw keypath
 * for Spanish and Polish users. This walks the whole catalog so the
 * Definition of Done's i18n gate is real rather than nominal.
 */

type Messages = Record<string, unknown>;

function collectKeyPaths(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) {
    return [prefix];
  }
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Messages)) {
    const next = prefix ? `${prefix}.${k}` : k;
    out.push(...collectKeyPaths(v, next));
  }
  return out;
}

function read(messages: unknown, path: string): string {
  const value = path
    .split(".")
    .reduce<unknown>(
      (acc, part) => (acc as Messages | undefined)?.[part as never],
      messages
    );
  return typeof value === "string" ? value : "";
}

const enKeys = collectKeyPaths(en).sort();

describe.each([
  ["Spanish", es],
  ["Polish", pl],
])("messages parity — %s covers en.json", (_locale, locale) => {
  const localeKeys = collectKeyPaths(locale).sort();

  it("has no missing and no extra keypaths", () => {
    const missing = enKeys.filter((k) => !localeKeys.includes(k));
    const extra = localeKeys.filter((k) => !enKeys.includes(k));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it("has no untranslated blanks where English has content", () => {
    // A blank is legitimate when English is blank too — the encyclopedia
    // leaves deficiencySigns empty for limit-only nutrients (sugar, sodium,
    // saturated fat). An untranslated blank is one that drops English copy.
    const blanks = enKeys.filter(
      (path) => read(en, path).trim() !== "" && read(locale, path).trim() === ""
    );
    expect(blanks).toEqual([]);
  });
});

describe("messages catalog", () => {
  it("exposes the same top-level namespaces in every locale", () => {
    const enNamespaces = Object.keys(en).sort();
    expect(Object.keys(es).sort()).toEqual(enNamespaces);
    expect(Object.keys(pl).sort()).toEqual(enNamespaces);
  });
});
