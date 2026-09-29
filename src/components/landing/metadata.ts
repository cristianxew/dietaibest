import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { defaultLocale, locales, type Locale } from "@/i18n/request";
import { localizedHref } from "./links";

const OPEN_GRAPH_LOCALES: Record<Locale, string> = {
  en: "en_US",
  es: "es_ES",
  pl: "pl_PL",
};

function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/**
 * Absolute base for canonical/hreflang/OG URLs, from `NEXTAUTH_URL` (the
 * public origin in every environment). `undefined` when unset or invalid, so
 * Next falls back to its default instead of the page failing to render.
 */
export function resolveMetadataBase(): URL | undefined {
  const raw = process.env.NEXTAUTH_URL;
  if (!raw) return undefined;
  try {
    return new URL(raw);
  } catch {
    return undefined;
  }
}

/** Localized title/description, canonical + hreflang alternates, Open Graph and Twitter card. */
export async function buildLandingMetadata(rawLocale: string): Promise<Metadata> {
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "landing.meta" });
  const title = t("title");
  const description = t("description");
  const canonical = localizedHref(locale, "/");

  return {
    metadataBase: resolveMetadataBase(),
    title: { absolute: title },
    description,
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, localizedHref(l, "/")])),
        "x-default": localizedHref(defaultLocale, "/"),
      },
    },
    openGraph: {
      type: "website",
      siteName: "DietAI",
      title,
      description,
      url: canonical,
      locale: OPEN_GRAPH_LOCALES[locale],
      alternateLocale: locales.filter((l) => l !== locale).map((l) => OPEN_GRAPH_LOCALES[l]),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
