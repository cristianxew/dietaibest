import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { defaultLocale, locales, type Locale } from "@/i18n/request";

const SIZE = { width: 1200, height: 630 };
const CONTENT_TYPE = "image/png";
const FONT_TIMEOUT_MS = 3000;

// Landing palette (light): src/app/globals.css `.landing`.
const BG = "#FAF8F4";
const FG = "#1C1A17";
const MUTED = "#8A8276";
const SAGE = "#4A7C59";
const SAGE_TINT = "#E6EDE6";

interface ImageParams {
  locale: string;
}

type MaybePromise<T> = T | Promise<T>;

function resolveLocale(value: string | undefined): Locale {
  return value && (locales as readonly string[]).includes(value) ? (value as Locale) : defaultLocale;
}

/**
 * The image is served at `/{locale}/opengraph-image/og.png`. The `.png` id is
 * deliberate: src/middleware.ts sends signed-out visitors (crawlers included)
 * on unknown routes to sign-in, but its matcher skips `*.png` paths, so the
 * image stays public without widening the middleware's route allowlist.
 */
export async function generateImageMetadata({ params }: { params: MaybePromise<ImageParams> }) {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "landing.meta" });
  return [{ id: "og.png", alt: t("title"), size: SIZE, contentType: CONTENT_TYPE }];
}

/**
 * Fetches a Google Fonts subset containing only `text` as TTF (Satori cannot
 * read woff2; Google serves TTF to non-browser user agents). Returns `null` on
 * any failure so the image still renders with the default font.
 */
async function loadGoogleFont(family: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`;
    const cssResponse = await fetch(cssUrl, { signal: AbortSignal.timeout(FONT_TIMEOUT_MS) });
    if (!cssResponse.ok) return null;
    const css = await cssResponse.text();
    const fontUrl = css.match(/src:\s*url\((.+?)\)\s*format\('(?:opentype|truetype)'\)/)?.[1];
    if (!fontUrl) return null;
    const fontResponse = await fetch(fontUrl, { signal: AbortSignal.timeout(FONT_TIMEOUT_MS) });
    if (!fontResponse.ok) return null;
    return await fontResponse.arrayBuffer();
  } catch {
    return null;
  }
}

type FontOption = NonNullable<NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]>;

/** Whatever subset of the landing fonts loaded; empty when none did. */
async function loadFonts(display: string, mono: string): Promise<FontOption> {
  const [serif, serifItalic, monoFont] = await Promise.all([
    loadGoogleFont("Playfair+Display:wght@500", display),
    loadGoogleFont("Playfair+Display:ital,wght@1,500", display),
    loadGoogleFont("JetBrains+Mono:wght@500", mono),
  ]);

  const fonts: FontOption = [];
  if (serif) fonts.push({ name: "Display", data: serif, weight: 500, style: "normal" });
  if (serifItalic) fonts.push({ name: "Display", data: serifItalic, weight: 500, style: "italic" });
  if (monoFont) fonts.push({ name: "Mono", data: monoFont, weight: 500, style: "normal" });
  return fonts;
}

/** Localized social card: cream background, the hero headline and the DietAI wordmark. */
export default async function OpengraphImage({ params }: { params: MaybePromise<ImageParams> }) {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "landing.hero" });
  const lead = t("titleLead");
  const accent = t("titleAccent");
  const eyebrow = t("eyebrow").toUpperCase();
  const wordmark = "DietAI";

  const fonts = await loadFonts(`${lead}${accent}`, `${eyebrow}${wordmark}`);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 88px",
          backgroundColor: BG,
          backgroundImage: `radial-gradient(circle at 88% 12%, ${SAGE_TINT} 0%, ${BG} 55%)`,
          color: FG,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 18, height: 18, borderRadius: 9999, backgroundColor: SAGE }} />
          <div style={{ fontFamily: "Mono", fontSize: 30, fontWeight: 500, letterSpacing: "-0.01em" }}>
            {wordmark}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 28,
              fontFamily: "Mono",
              fontSize: 20,
              letterSpacing: "0.14em",
              color: MUTED,
            }}
          >
            <div style={{ width: 40, height: 2, backgroundColor: MUTED }} />
            {eyebrow}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontFamily: "Display",
              fontSize: 112,
              fontWeight: 500,
              lineHeight: 1.02,
              letterSpacing: "-0.025em",
            }}
          >
            <span>{lead}</span>
            <span style={{ fontStyle: "italic", color: SAGE }}>{accent}</span>
          </div>
        </div>

        <div style={{ display: "flex", height: 6, width: 120, borderRadius: 9999, backgroundColor: SAGE }} />
      </div>
    ),
    // An empty `fonts` array would disable the built-in default font; omit it instead.
    { ...SIZE, ...(fonts.length > 0 ? { fonts } : {}) }
  );
}
