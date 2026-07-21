/**
 * URL canonicalizer for recipe-import dedup.
 *
 * Pure, table-driven — no I/O, no network. Maps the many spellings of the same
 * page (tracking params, share links, mobile hosts, short-link variants) onto
 * one stable string stored in `Recipe.canonicalUrl`, so two imports of the
 * same content can be detected by plain equality.
 *
 * Returns null for anything that isn't an http(s) URL. Image imports store a
 * storage media path in `sourceUrl` (e.g. `IMG_1234.png`), which fails URL
 * parsing — that null is what keeps them out of dedup.
 *
 * Known limitation (accepted): redirect short links (`vm.tiktok.com`,
 * `fb.watch`, bit.ly, …) canonicalize as themselves and will NOT match their
 * expanded form — resolving them would require network calls.
 */

/** Exact-name tracking/share params dropped everywhere (plus any `utm_*`). */
const TRACKING_PARAMS: ReadonlySet<string> = new Set([
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igsh",
  "igshid",
  "si",
  "feature",
  "ref",
  "ref_src",
  "share_id",
  "_ga",
]);

const isTrackingParam = (name: string): boolean =>
  name.startsWith("utm_") || TRACKING_PARAMS.has(name);

const hostMatches = (host: string, base: string): boolean =>
  host === base || host.endsWith(`.${base}`);

/** Non-empty path segments, preserving case ("/reel/AbC/" → ["reel", "AbC"]). */
const segmentsOf = (path: string): string[] => path.split("/").filter(Boolean);

const singleParam = (name: string, value: string): URLSearchParams => {
  const params = new URLSearchParams();
  params.set(name, value);
  return params;
};

export function canonicalizeRecipeUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  let host = url.hostname.toLowerCase().replace(/^www\./, "");
  let path = url.pathname;
  let params = new URLSearchParams(url.search);

  // Platform rules first — they decide host/path shape and which params
  // survive. Hosts align with VIDEO_HOST_PATTERNS in
  // src/lib/chat/ingestion/select-strategy.ts.
  if (host === "youtu.be") {
    // youtu.be/<id> → youtube.com/watch?v=<id>. Without an id there is no
    // video identity — returning a bare watch URL would collapse every such
    // link onto ONE canonical key and cross-match unrelated recipes.
    const [id] = segmentsOf(path);
    if (!id) return null;
    host = "youtube.com";
    path = "/watch";
    params = singleParam("v", id);
  } else if (hostMatches(host, "youtube.com")) {
    host = "youtube.com"; // collapses m. / music.
    const segments = segmentsOf(path);
    if (["shorts", "embed", "live"].includes(segments[0] ?? "")) {
      if (!segments[1]) return null;
      path = "/watch";
      params = singleParam("v", segments[1]);
    } else if (segments[0] === "watch") {
      // Keep ONLY the video id — t/list/index/pp/ab_channel are all noise.
      // watch without v (e.g. a playlist-only link) has no video identity.
      const v = params.get("v");
      if (!v) return null;
      path = "/watch";
      params = singleParam("v", v);
    }
  } else if (hostMatches(host, "instagram.com")) {
    host = "instagram.com";
    const segments = segmentsOf(path);
    const kind = segments[0] === "reels" ? "reel" : segments[0];
    if (["reel", "p", "tv"].includes(kind ?? "") && segments[1]) {
      path = `/${kind}/${segments[1]}`;
    }
    params = new URLSearchParams();
  } else if (hostMatches(host, "tiktok.com")) {
    // vm./vt. short hosts stay distinct on purpose (no redirect resolution).
    if (host === "tiktok.com" || host === "m.tiktok.com") {
      host = "tiktok.com";
    }
    params = new URLSearchParams();
  } else if (hostMatches(host, "twitter.com") || hostMatches(host, "x.com")) {
    host = "x.com";
    params = new URLSearchParams();
  } else if (hostMatches(host, "facebook.com")) {
    host = "facebook.com";
    if (segmentsOf(path)[0] === "watch") {
      const v = params.get("v");
      if (!v) return null;
      path = "/watch";
      params = singleParam("v", v);
    }
  } else if (host === "fb.watch") {
    params = new URLSearchParams();
  }

  // Generic normalization on whatever survived the platform pass.
  for (const name of [...params.keys()]) {
    if (isTrackingParam(name)) {
      params.delete(name);
    }
  }
  params.sort();
  path = path.replace(/\/+$/, "");

  const query = params.toString();
  return `https://${host}${path}${query ? `?${query}` : ""}`;
}
