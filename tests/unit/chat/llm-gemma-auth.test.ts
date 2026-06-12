import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * GemmaProvider must authenticate Vertex AI exactly like generateRecipeImage
 * does (PR #25): with the Document AI service-account key file when
 * GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH is set. Without it the SDK falls back to
 * Application Default Credentials → the GCP metadata server, which does not
 * exist on the self-hosted VPS → every extraction dies with
 * GemmaExtractionError("transient") and URL imports fail in production.
 */

const ctorSpy = vi.hoisted(() => vi.fn());
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {};
    constructor(opts: unknown) {
      ctorSpy(opts);
    }
  },
}));

import { GemmaProvider } from "@/lib/chat/llm-gemma";

describe("GemmaProvider — Vertex auth options", () => {
  beforeEach(() => {
    ctorSpy.mockClear();
    vi.stubEnv("GOOGLE_CLOUD_PROJECT_ID", "proj-1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes the service-account key file when GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH is set", () => {
    vi.stubEnv("GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH", "/secrets/sa.json");

    new GemmaProvider();

    expect(ctorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        vertexai: true,
        project: "proj-1",
        googleAuthOptions: { keyFilename: "/secrets/sa.json" },
      })
    );
  });

  it("keeps default ADC behaviour when the key path is unset (local dev)", () => {
    vi.stubEnv("GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH", "");

    new GemmaProvider();

    const opts = ctorSpy.mock.calls[0]?.[0] as
      | { googleAuthOptions?: unknown }
      | undefined;
    expect(opts).toBeDefined();
    expect(opts?.googleAuthOptions).toBeUndefined();
  });

  it("still throws a configuration error when GOOGLE_CLOUD_PROJECT_ID is missing", () => {
    vi.stubEnv("GOOGLE_CLOUD_PROJECT_ID", "");

    expect(() => new GemmaProvider()).toThrow(/GOOGLE_CLOUD_PROJECT_ID/);
  });
});
