/**
 * Content model for legal documents (Terms, Privacy, Cookies).
 *
 * Legal copy is kept out of `messages/*.json` on purpose: those bundles are
 * loaded on every route, and the legal corpus is several thousand words per
 * locale. Documents live here as typed modules so each legal route pulls in
 * only its own text, server-side.
 */

/** Inline markup supported inside every `text` field. */
export type InlineMarkup = string;

export type LegalBlock =
  | { kind: "p"; text: InlineMarkup }
  | { kind: "ul"; items: InlineMarkup[] }
  | { kind: "ol"; items: InlineMarkup[] }
  | {
      kind: "table";
      caption?: string;
      headers: string[];
      rows: InlineMarkup[][];
    }
  | {
      kind: "callout";
      tone: "warning" | "info";
      title: string;
      text: InlineMarkup;
    };

export interface LegalSection {
  /** Stable anchor id. Never change one after publication — external parties cite them. */
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  title: string;
  /** One-line summary shown under the title and used as the meta description. */
  summary: string;
  /** ISO date the version takes effect. */
  effectiveDate: string;
  /** ISO date of the last substantive edit. */
  lastUpdated: string;
  /**
   * Semantic version of the document. Bump the major on any change that
   * materially affects users — GDPR Art. 12 requires you to actively notify
   * them rather than silently amend the page.
   */
  version: string;
  intro: LegalBlock[];
  sections: LegalSection[];
}

export type LegalDocumentSlug = "terms" | "privacy" | "cookies";
