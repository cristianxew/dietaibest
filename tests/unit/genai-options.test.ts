import { describe, it, expect, vi } from "vitest";

import {
  buildGenAIVertexOptions,
  resolveGoogleServiceAccountAuth,
} from "@/lib/chat/tools/genai-options";

const SA_JSON = JSON.stringify({
  type: "service_account",
  project_id: "proj-1",
  private_key: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
  client_email: "sa@proj-1.iam.gserviceaccount.com",
});

describe("buildGenAIVertexOptions", () => {
  it("returns null when GOOGLE_CLOUD_PROJECT_ID is missing", () => {
    expect(buildGenAIVertexOptions({})).toBeNull();
    expect(
      buildGenAIVertexOptions({ GOOGLE_VERTEX_LOCATION: "us-central1" })
    ).toBeNull();
  });

  it("builds Vertex options with the default location when none is provided", () => {
    expect(
      buildGenAIVertexOptions({ GOOGLE_CLOUD_PROJECT_ID: "proj-1" })
    ).toEqual({
      vertexai: true,
      project: "proj-1",
      location: "us-central1",
    });
  });

  it("uses the provided location", () => {
    const opts = buildGenAIVertexOptions({
      GOOGLE_CLOUD_PROJECT_ID: "proj-1",
      GOOGLE_VERTEX_LOCATION: "europe-west4",
    });
    expect(opts?.location).toBe("europe-west4");
  });

  it("passes the service-account key file via googleAuthOptions when GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH is set", () => {
    const opts = buildGenAIVertexOptions({
      GOOGLE_CLOUD_PROJECT_ID: "proj-1",
      GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH: "/app/secrets/gcp-service-account.json",
    });
    expect(opts).toEqual({
      vertexai: true,
      project: "proj-1",
      location: "us-central1",
      googleAuthOptions: { keyFilename: "/app/secrets/gcp-service-account.json" },
    });
  });

  it("omits googleAuthOptions when no key file path is configured (falls back to ADC)", () => {
    const opts = buildGenAIVertexOptions({ GOOGLE_CLOUD_PROJECT_ID: "proj-1" });
    expect(opts).not.toHaveProperty("googleAuthOptions");
  });

  it("passes inline credentials when GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON is set", () => {
    const opts = buildGenAIVertexOptions({
      GOOGLE_CLOUD_PROJECT_ID: "proj-1",
      GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON: SA_JSON,
    });
    expect(opts?.googleAuthOptions).toEqual({
      credentials: JSON.parse(SA_JSON),
    });
  });

  it("prefers inline JSON over the key file path when both are set", () => {
    const opts = buildGenAIVertexOptions({
      GOOGLE_CLOUD_PROJECT_ID: "proj-1",
      GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON: SA_JSON,
      GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH: "/app/secrets/gcp-service-account.json",
    });
    expect(opts?.googleAuthOptions).toEqual({
      credentials: JSON.parse(SA_JSON),
    });
  });
});

describe("resolveGoogleServiceAccountAuth", () => {
  it("returns parsed credentials from the JSON env var", () => {
    expect(
      resolveGoogleServiceAccountAuth({ GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON: SA_JSON })
    ).toEqual({ credentials: JSON.parse(SA_JSON) });
  });

  it("returns the key file path when only the path is set", () => {
    expect(
      resolveGoogleServiceAccountAuth({
        GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH: "/app/secrets/gcp-service-account.json",
      })
    ).toEqual({ keyFilename: "/app/secrets/gcp-service-account.json" });
  });

  it("returns null when neither is set (ADC fallback)", () => {
    expect(resolveGoogleServiceAccountAuth({})).toBeNull();
  });

  it("ignores an empty-string JSON var (Dokploy unset default) and falls back to the path", () => {
    expect(
      resolveGoogleServiceAccountAuth({
        GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON: "",
        GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH: "/app/secrets/gcp-service-account.json",
      })
    ).toEqual({ keyFilename: "/app/secrets/gcp-service-account.json" });
  });

  it("logs and falls back to the key file when the JSON is malformed (no silent auth switch)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = resolveGoogleServiceAccountAuth({
      GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON: "{ not valid json",
      GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH: "/app/secrets/gcp-service-account.json",
    });
    expect(result).toEqual({ keyFilename: "/app/secrets/gcp-service-account.json" });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON"),
      expect.anything()
    );
    errorSpy.mockRestore();
  });

  it("does not throw on malformed JSON with no path (returns null → ADC)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      resolveGoogleServiceAccountAuth({ GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON: "oops" })
    ).toBeNull();
    errorSpy.mockRestore();
  });
});
