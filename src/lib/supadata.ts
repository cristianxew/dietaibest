/**
 * Supadata API Client (DIE-35)
 *
 * Thin HTTP wrapper modelled structurally on `browser-use.ts`. Exposes the
 * three methods the in-app agent needs:
 *  - `extractVideo(url, schema)` — POST /extract (async, polls /extract/{jobId})
 *  - `scrapeWeb(url)`            — GET  /web/scrape (sync)
 *  - `getTranscript(url, opts?)` — GET  /transcript (sync or async)
 *
 * Authentication: `x-api-key` header, configured from `SUPADATA_API_KEY`.
 * Docs: https://docs.supadata.ai
 */

// ============================================================================
// Types
// ============================================================================

export interface SupadataConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  /** Poll interval for async jobs (ms). Docs: poll every 1 second. */
  pollIntervalMs?: number;
  /** Max polling attempts before timing out a job. */
  pollMaxAttempts?: number;
}

export class SupadataError extends Error {
  public code: string;
  public status?: number;
  public details?: unknown;
  constructor(code: string, message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "SupadataError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** Minimal JSON-Schema shape we send to /extract. */
export type JsonSchema = Record<string, unknown>;

/** Job envelope returned by polling endpoints. */
export interface JobStatus<TData = unknown> {
  status: "queued" | "active" | "completed" | "failed";
  data?: TData;
  error?: unknown;
}

/** Response shape for GET /web/scrape (sync). */
export interface ScrapeResult {
  url: string;
  content: string;
  name?: string;
  description?: string;
  ogUrl?: string;
  countCharacters?: number;
  urls?: string[];
}

/** Response shape for GET /transcript (sync). `content` is plain text when text=true. */
export interface TranscriptResult {
  content: string;
  lang?: string;
  availableLangs?: string[];
}

// ============================================================================
// Client
// ============================================================================

const DEFAULT_BASE_URL = "https://api.supadata.ai/v1";

export class SupadataClient {
  private readonly config: Required<SupadataConfig>;

  constructor(config: SupadataConfig) {
    if (!config.apiKey) {
      throw new Error("Supadata API key is required");
    }
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      timeout: config.timeout ?? 60_000,
      pollIntervalMs: config.pollIntervalMs ?? 1_000,
      pollMaxAttempts: config.pollMaxAttempts ?? 60,
    };
  }

  /**
   * Extract structured data from a video URL using AI + JSON Schema.
   * Async job: POST /extract returns 202 + jobId; we poll /extract/{jobId}
   * until status === "completed" | "failed".
   */
  async extractVideo<TData = unknown>(
    url: string,
    schema: JsonSchema,
    opts?: { prompt?: string; signal?: AbortSignal }
  ): Promise<TData> {
    const start = await this.request<{ jobId?: string; data?: TData }>(
      "/extract",
      {
        method: "POST",
        body: JSON.stringify({ url, schema, prompt: opts?.prompt }),
        signal: opts?.signal,
      }
    );
    // Sync responses (HTTP 200 with data) are not documented but tolerated.
    if (start.data !== undefined && !start.jobId) return start.data;
    if (!start.jobId) {
      throw new SupadataError(
        "INVALID_RESPONSE",
        "Supadata /extract returned no jobId and no data",
        502,
        start
      );
    }
    return this.pollJob<TData>(
      `/extract/${encodeURIComponent(start.jobId)}`,
      opts?.signal
    );
  }

  /** Scrape a web page to markdown + metadata. */
  async scrapeWeb(
    url: string,
    opts?: { noLinks?: boolean; lang?: string; signal?: AbortSignal }
  ): Promise<ScrapeResult> {
    const params = new URLSearchParams({ url });
    if (opts?.noLinks) params.set("noLinks", "true");
    if (opts?.lang) params.set("lang", opts.lang);
    return this.request<ScrapeResult>(`/web/scrape?${params.toString()}`, {
      method: "GET",
      signal: opts?.signal,
    });
  }

  /**
   * Get a transcript for any supported video URL (YouTube, TikTok, Instagram,
   * X, Facebook, or file URL). Sync 200 returns the transcript inline; 202
   * returns `{ jobId }` and we poll /transcript/{jobId}.
   */
  async getTranscript(
    url: string,
    opts?: {
      lang?: string;
      text?: boolean;
      mode?: "native" | "auto" | "generate";
      signal?: AbortSignal;
    }
  ): Promise<TranscriptResult> {
    const params = new URLSearchParams({ url });
    if (opts?.lang) params.set("lang", opts.lang);
    if (opts?.text !== undefined) params.set("text", String(opts.text));
    if (opts?.mode) params.set("mode", opts.mode);

    const res = await this.request<TranscriptResult & { jobId?: string }>(
      `/transcript?${params.toString()}`,
      { method: "GET", signal: opts?.signal }
    );
    if (res.jobId) {
      return this.pollJob<TranscriptResult>(
        `/transcript/${encodeURIComponent(res.jobId)}`,
        opts?.signal
      );
    }
    return res;
  }

  // --------------------------------------------------------------------------
  // Polling + transport
  // --------------------------------------------------------------------------

  private async pollJob<TData>(
    path: string,
    signal?: AbortSignal
  ): Promise<TData> {
    const { pollIntervalMs, pollMaxAttempts } = this.config;
    for (let attempt = 0; attempt < pollMaxAttempts; attempt++) {
      if (signal?.aborted) {
        throw new SupadataError("ABORTED", "Job polling aborted", 499);
      }
      const job = await this.request<JobStatus<TData>>(path, {
        method: "GET",
        signal,
      });
      if (job.status === "completed") {
        if (job.data === undefined) {
          throw new SupadataError(
            "INVALID_RESPONSE",
            "Job completed without data",
            502,
            job
          );
        }
        return job.data;
      }
      if (job.status === "failed") {
        throw new SupadataError(
          "JOB_FAILED",
          typeof job.error === "string" ? job.error : "Supadata job failed",
          422,
          job
        );
      }
      await sleep(pollIntervalMs);
    }
    throw new SupadataError(
      "JOB_TIMEOUT",
      `Job did not complete after ${pollMaxAttempts} polls`,
      408
    );
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    // Compose caller's signal with our timeout controller.
    if (init.signal) {
      init.signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }

    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          "x-api-key": this.config.apiKey,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await safeJson(response);
        const upstreamMessage =
          errorBody && typeof errorBody === "object" && "message" in errorBody
            ? String((errorBody as { message: unknown }).message)
            : `HTTP ${response.status}`;
        throw new SupadataError(
          response.status >= 500 ? "UPSTREAM_ERROR" : "REQUEST_ERROR",
          upstreamMessage,
          response.status,
          errorBody
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof SupadataError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new SupadataError("TIMEOUT", "Supadata request timed out", 408);
      }
      throw new SupadataError(
        "NETWORK_ERROR",
        error instanceof Error ? error.message : String(error),
        500
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Factory
// ============================================================================

let defaultClient: SupadataClient | null = null;

export function getSupadataClient(): SupadataClient {
  if (!defaultClient) {
    const apiKey = process.env.SUPADATA_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Supadata API key is required. Set SUPADATA_API_KEY environment variable."
      );
    }
    defaultClient = new SupadataClient({ apiKey });
  }
  return defaultClient;
}
