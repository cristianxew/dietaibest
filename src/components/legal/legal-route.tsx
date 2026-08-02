import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLegalDocument, type LegalDocumentSlug } from "@/content/legal";
import { locales, type Locale } from "@/i18n/request";
import { productUrls } from "@/content/legal/config";
import { LegalDocumentPage } from "./LegalDocumentPage";

export interface LegalRouteParams {
  params: Promise<{ locale: string }>;
}

function resolveLocale(raw: string): Locale | null {
  return locales.includes(raw as Locale) ? (raw as Locale) : null;
}

const NAV_LINKS: { slug: LegalDocumentSlug; href: string; label: string }[] = [
  { slug: "terms", href: productUrls.terms, label: "Terms of Service" },
  { slug: "privacy", href: productUrls.privacy, label: "Privacy Policy" },
  { slug: "cookies", href: productUrls.cookies, label: "Cookie Policy" },
];

export function buildLegalMetadata(slug: LegalDocumentSlug) {
  return async function generateMetadata({
    params,
  }: LegalRouteParams): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale) ?? "en";
    const { document } = getLegalDocument(slug, locale);

    return {
      title: `${document.title} — Dietai`,
      description: document.summary,
      alternates: { canonical: productUrls[slug] },
      // Legal pages should be indexable — people look for them before signing up.
      robots: { index: true, follow: true },
    };
  };
}

export function buildLegalPage(slug: LegalDocumentSlug) {
  return async function LegalPage({ params }: LegalRouteParams) {
    const { locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale);
    if (!locale) notFound();

    const { document, isFallback } = getLegalDocument(slug, locale);

    return (
      <main className="min-h-screen bg-background">
        <div className="border-b border-border">
          <div className="mx-auto flex w-full max-w-[760px] flex-wrap items-center justify-between gap-4 px-6 py-5">
            <Link
              href="/"
              className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-[-0.02em] text-foreground"
            >
              <span
                className="grid h-7 w-7 place-items-center rounded-[8px] bg-foreground text-base font-semibold text-background"
                style={{ fontStyle: "italic" }}
              >
                d
              </span>
              <span>dietai</span>
            </Link>
            <nav className="flex flex-wrap gap-5 text-sm">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.slug}
                  href={link.href}
                  aria-current={link.slug === slug ? "page" : undefined}
                  className={
                    link.slug === slug
                      ? "font-medium text-foreground"
                      : "text-muted-foreground transition-colors hover:text-foreground"
                  }
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <LegalDocumentPage
          document={document}
          isFallback={isFallback}
          fallbackNotice="A translation into your language is not available yet. The English text below is the authoritative version of this document."
        />
      </main>
    );
  };
}

export function generateLegalStaticParams() {
  return locales.map((locale) => ({ locale }));
}
