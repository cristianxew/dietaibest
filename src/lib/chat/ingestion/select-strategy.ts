/**
 * Ingestion strategy selector for the `importRecipeFromUrl` agent tool (DIE-35).
 *
 * Pure, table-driven binary classifier. Decides whether a URL should be
 * processed through Supadata's structured video extraction (`/extract`) or
 * its web scrape (`/web/scrape`) endpoint. No I/O, no LLM calls — just a
 * domain check so the routing is trivially testable and deterministic.
 *
 * Architecture note (Decisión 8): there is NO Browser-Use fallback in v1.
 * If the selected Supadata path fails, the tool surfaces `tool.failed` with
 * a specific reason and does NOT retry with another provider. Telemetry
 * captures host + reason so we can later decide host-specific fallbacks
 * based on real demand.
 */

export type IngestStrategy = "supadata-video" | "supadata-web";

/**
 * Host substrings that map to Supadata's video/social transcript+extract path.
 * Substring match is intentional — we want to catch country/regional subdomains
 * (e.g. `m.youtube.com`, `www.tiktok.com`, `fb.watch`) without enumerating them.
 */
const VIDEO_HOST_PATTERNS: ReadonlyArray<string> = [
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "instagram.com",
  "facebook.com",
  "fb.watch",
  "x.com",
  "twitter.com",
];

/**
 * Returns the strategy to use for a given URL.
 *
 * - `supadata-video` for known video/social hosts (YouTube, TikTok, Instagram,
 *   Facebook, X/Twitter).
 * - `supadata-web` for anything else that parses as an http(s) URL.
 *
 * Throws on a malformed URL — callers (the tool) translate this into
 * `tool.failed { reason: "ingest-failed" }` rather than letting it surface.
 */
export function selectIngestStrategy(url: string): IngestStrategy {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }
  const host = parsed.hostname.toLowerCase();
  for (const pattern of VIDEO_HOST_PATTERNS) {
    if (host === pattern || host.endsWith(`.${pattern}`) || host === pattern.replace(/^www\./, "")) {
      return "supadata-video";
    }
  }
  return "supadata-web";
}
