import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { SupadataClient, SupadataError, parseRetryAfterMs } from "@/lib/supadata";

function makeResponse(
  body: unknown,
  init: { status?: number } = {}
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("SupadataClient — transport + auth shape", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let client: SupadataClient;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    client = new SupadataClient({
      apiKey: "test-key",
      baseUrl: "https://api.example.test/v1",
      pollIntervalMs: 1,
      pollMaxAttempts: 5,
      // Keep retry backoff effectively instant so the 429 tests stay fast.
      retryBaseDelayMs: 1,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws if the API key is missing", () => {
    expect(() => new SupadataClient({ apiKey: "" })).toThrow(/API key/);
  });

  describe("scrapeWeb", () => {
    it("sends GET /web/scrape with the URL in the query string and x-api-key header", async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse({
          url: "https://recipes.example.com/abc",
          content: "# Some recipe markdown",
          name: "Some Recipe",
        })
      );

      const result = await client.scrapeWeb("https://recipes.example.com/abc");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [calledUrl, init] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(
        "https://api.example.test/v1/web/scrape?url=https%3A%2F%2Frecipes.example.com%2Fabc"
      );
      expect(init.method).toBe("GET");
      expect(init.headers["x-api-key"]).toBe("test-key");
      expect(result.name).toBe("Some Recipe");
      expect(result.content).toContain("Some recipe markdown");
    });

    it("surfaces an HTTP 4xx as a SupadataError with REQUEST_ERROR code", async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse({ message: "Bad URL" }, { status: 400 })
      );

      await expect(
        client.scrapeWeb("https://no-good")
      ).rejects.toMatchObject({
        name: "SupadataError",
        code: "REQUEST_ERROR",
        status: 400,
      });
    });

    it("surfaces an HTTP 5xx as UPSTREAM_ERROR", async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse({ message: "Upstream blew up" }, { status: 503 })
      );

      await expect(
        client.scrapeWeb("https://flaky.example.com/recipe")
      ).rejects.toMatchObject({
        name: "SupadataError",
        code: "UPSTREAM_ERROR",
        status: 503,
      });
    });
  });

  describe("extractVideo", () => {
    it("POSTs /extract with url + schema and polls /extract/{jobId} until completed", async () => {
      const schema = { type: "object", properties: { title: { type: "string" } } };
      fetchSpy
        .mockResolvedValueOnce(makeResponse({ jobId: "job-1" }, { status: 202 }))
        .mockResolvedValueOnce(makeResponse({ status: "queued" }))
        .mockResolvedValueOnce(
          makeResponse({
            status: "completed",
            data: { title: "Tacos al pastor", ingredients: [], instructions: [] },
          })
        );

      const data = await client.extractVideo<{
        title: string;
        ingredients: unknown[];
        instructions: unknown[];
      }>("https://www.tiktok.com/@chef/video/1", schema);

      expect(fetchSpy).toHaveBeenCalledTimes(3);
      const [postUrl, postInit] = fetchSpy.mock.calls[0];
      expect(postUrl).toBe("https://api.example.test/v1/extract");
      expect(postInit.method).toBe("POST");
      expect(postInit.headers["x-api-key"]).toBe("test-key");
      const postBody = JSON.parse(postInit.body as string);
      expect(postBody.url).toBe("https://www.tiktok.com/@chef/video/1");
      expect(postBody.schema).toEqual(schema);

      const [pollUrl, pollInit] = fetchSpy.mock.calls[2];
      expect(pollUrl).toBe("https://api.example.test/v1/extract/job-1");
      expect(pollInit.method).toBe("GET");

      expect(data.title).toBe("Tacos al pastor");
    });

    it("raises JOB_FAILED if the polled job fails", async () => {
      fetchSpy
        .mockResolvedValueOnce(makeResponse({ jobId: "job-x" }, { status: 202 }))
        .mockResolvedValueOnce(
          makeResponse({ status: "failed", error: "could not parse video" })
        );

      await expect(
        client.extractVideo(
          "https://www.tiktok.com/@x/video/2",
          { type: "object" }
        )
      ).rejects.toMatchObject({ name: "SupadataError", code: "JOB_FAILED" });
    });

    it("times out polling after pollMaxAttempts queued responses", async () => {
      fetchSpy
        .mockResolvedValueOnce(makeResponse({ jobId: "job-q" }, { status: 202 }))
        // Response bodies can only be read once — return a fresh Response per call.
        .mockImplementation(async () => makeResponse({ status: "queued" }));

      await expect(
        client.extractVideo(
          "https://www.tiktok.com/@x/video/3",
          { type: "object" }
        )
      ).rejects.toMatchObject({ name: "SupadataError", code: "JOB_TIMEOUT" });
    });
  });

  describe("getTranscript", () => {
    it("returns inline transcript content on a sync 200", async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse({ content: "hello world", lang: "en" })
      );
      const result = await client.getTranscript(
        "https://youtu.be/abc",
        { text: true }
      );
      expect(result.content).toBe("hello world");
      expect(result.lang).toBe("en");
      const [calledUrl] = fetchSpy.mock.calls[0];
      expect(calledUrl).toContain("/transcript?");
      expect(calledUrl).toContain("text=true");
    });

    it("polls /transcript/{jobId} when the initial response returns a jobId", async () => {
      fetchSpy
        .mockResolvedValueOnce(makeResponse({ jobId: "tx-1" }, { status: 202 }))
        .mockResolvedValueOnce(
          makeResponse({ status: "completed", data: { content: "async transcript" } })
        );
      const result = await client.getTranscript("https://www.tiktok.com/@x/video/4");
      expect(result.content).toBe("async transcript");
    });
  });

  describe("HTTP 429 retry/backoff", () => {
    function rateLimited(retryAfter?: string): Response {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (retryAfter !== undefined) headers["Retry-After"] = retryAfter;
      return new Response(JSON.stringify({ message: "Rate limit exceeded" }), {
        status: 429,
        headers,
      });
    }

    it("retries on a 429 and resolves once a later attempt succeeds", async () => {
      // Fresh Response per call — bodies can only be read once.
      fetchSpy
        .mockImplementationOnce(async () => rateLimited())
        .mockImplementationOnce(async () =>
          makeResponse({ url: "u", content: "ok", name: "Recipe" })
        );

      const result = await client.scrapeWeb("https://recipes.example.com/x");

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result.name).toBe("Recipe");
    });

    it("retries up to maxRetries then surfaces the 429 as REQUEST_ERROR", async () => {
      fetchSpy.mockImplementation(async () => rateLimited());

      await expect(
        client.scrapeWeb("https://recipes.example.com/x")
      ).rejects.toMatchObject({
        name: "SupadataError",
        code: "REQUEST_ERROR",
        status: 429,
      });
      // 1 initial attempt + 2 retries (default maxRetries).
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("does NOT retry a non-429 4xx", async () => {
      fetchSpy.mockImplementationOnce(async () =>
        makeResponse({ message: "Bad URL" }, { status: 400 })
      );

      await expect(
        client.scrapeWeb("https://no-good")
      ).rejects.toMatchObject({ code: "REQUEST_ERROR", status: 400 });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("parseRetryAfterMs", () => {
    it("parses an integer Retry-After (seconds) into milliseconds", () => {
      expect(parseRetryAfterMs("2")).toBe(2000);
    });

    it("returns null when the header is absent", () => {
      expect(parseRetryAfterMs(null)).toBeNull();
    });

    it("returns null for a non-numeric Retry-After", () => {
      expect(parseRetryAfterMs("soon")).toBeNull();
    });
  });

  it("converts unexpected fetch errors into NETWORK_ERROR SupadataError", async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError("network unreachable"));
    await expect(
      client.scrapeWeb("https://example.test/x")
    ).rejects.toBeInstanceOf(SupadataError);
  });
});
