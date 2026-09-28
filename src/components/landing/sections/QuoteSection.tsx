interface QuoteSectionProps {
  /** The quote itself, without surrounding quotation marks. */
  quote: string;
  /** Who said it, e.g. "Name, City · 6 months on DietAI". */
  attribution: string;
}

/**
 * Single pull quote. Not rendered on the landing yet: enable it only with a
 * real customer quote the person agreed to publish
 * (see src/app/[locale]/(public-pages)/page.tsx).
 */
export function QuoteSection({ quote, attribution }: QuoteSectionProps) {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-[1180px] px-8">
        <figure className="mx-auto max-w-[28ch] py-12 text-center">
          <blockquote className="font-lp-display text-[clamp(28px,4.2vw,44px)] font-medium italic leading-[1.2] tracking-[-0.01em] text-lp-fg">
            <span aria-hidden="true" className="text-lp-primary">
              {'"'}
            </span>
            {quote}
            <span aria-hidden="true" className="text-lp-primary">
              {'"'}
            </span>
          </blockquote>
          <figcaption className="mt-8 font-lp-mono text-[14px] tracking-[0.04em] text-lp-muted">
            — {attribution}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
