import type { Locale } from "@/i18n/request";
import type { LegalDocument, LegalDocumentSlug } from "./types";
import { privacyPolicyEn } from "./en/privacy";
import { termsOfServiceEn } from "./en/terms";
import { cookiePolicyEn } from "./en/cookies";

export type { LegalDocument, LegalDocumentSlug, LegalBlock, LegalSection } from "./types";

/**
 * The authoritative language of every legal document.
 *
 * Legal text is deliberately NOT machine-translated. A GDPR notice is read by
 * the supervisory authority in the language it is published in, and a mistaken
 * translation of a legal basis or a liability clause is a substantive defect,
 * not a copy nit. Polish and Spanish versions must be produced by a qualified
 * legal translator and slotted in below.
 */
export const AUTHORITATIVE_LOCALE: Locale = "en";

const documents: Record<Locale, Partial<Record<LegalDocumentSlug, LegalDocument>>> = {
  en: {
    privacy: privacyPolicyEn,
    terms: termsOfServiceEn,
    cookies: cookiePolicyEn,
  },
  // TODO: add professionally translated `pl` documents.
  pl: {},
  // TODO: add professionally translated `es` documents.
  es: {},
};

export interface ResolvedLegalDocument {
  document: LegalDocument;
  /** The locale the returned text is actually written in. */
  resolvedLocale: Locale;
  /** True when the requested locale had no translation and we fell back. */
  isFallback: boolean;
}

/**
 * Resolves a document for a locale, falling back to the authoritative locale.
 *
 * The `isFallback` flag is not cosmetic: when it is set the page must tell the
 * reader they are looking at the English text, so nobody assumes a translation
 * exists that does not.
 */
export function getLegalDocument(
  slug: LegalDocumentSlug,
  locale: Locale
): ResolvedLegalDocument {
  const requested = documents[locale]?.[slug];
  if (requested) {
    return { document: requested, resolvedLocale: locale, isFallback: false };
  }

  const fallback = documents[AUTHORITATIVE_LOCALE][slug];
  if (!fallback) {
    throw new Error(`No legal document registered for slug "${slug}".`);
  }

  return {
    document: fallback,
    resolvedLocale: AUTHORITATIVE_LOCALE,
    isFallback: locale !== AUTHORITATIVE_LOCALE,
  };
}
