import { describe, it, expect } from "vitest";

import en from "../../messages/en.json";
import es from "../../messages/es.json";
import pl from "../../messages/pl.json";

/**
 * Translation parity test for the `auth.*` namespace.
 *
 * The magic-link callback, forgot-password and reset-password screens are the
 * only UI a locked-out user can reach — a missing key there renders
 * "auth.key.not.found" on the one page that has to work.
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

const enKeys = collectKeyPaths((en as { auth: unknown }).auth).sort();
const esKeys = collectKeyPaths((es as { auth: unknown }).auth).sort();
const plKeys = collectKeyPaths((pl as { auth: unknown }).auth).sort();

describe("messages/{en,es,pl}.json — auth.* namespace parity", () => {
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

  it("covers every key the password-recovery screens render", () => {
    const required = [
      "auth.forgotPassword.link",
      "auth.forgotPassword.title",
      "auth.forgotPassword.sendResetLink",
      "auth.forgotPassword.emailSentTo",
      "auth.resetPassword.title",
      "auth.resetPassword.newPassword",
      "auth.resetPassword.updatePassword",
      "auth.resetPassword.linkExpired",
      "auth.callback.linkExpiredMessage",
      "auth.callback.sessionFailed",
    ];

    const present = enKeys.map((k) => `auth.${k}`);
    expect(required.filter((k) => !present.includes(k))).toEqual([]);
  });
});
