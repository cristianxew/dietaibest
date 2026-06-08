import { describe, it, expect } from "vitest";

import { buildGenAIVertexOptions } from "@/lib/chat/tools/genai-options";

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
});
