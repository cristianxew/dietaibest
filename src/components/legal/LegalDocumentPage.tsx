import type { LegalBlock, LegalDocument } from "@/content/legal";
import { LegalInline } from "./LegalInline";

function BlockRenderer({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "p":
      return (
        <p className="text-[15px] leading-7 text-muted-foreground">
          <LegalInline text={block.text} />
        </p>
      );

    case "ul":
      return (
        <ul className="space-y-2.5 pl-5">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="list-disc text-[15px] leading-7 text-muted-foreground marker:text-border"
            >
              <LegalInline text={item} />
            </li>
          ))}
        </ul>
      );

    case "ol":
      return (
        <ol className="space-y-2.5 pl-5">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="list-decimal text-[15px] leading-7 text-muted-foreground marker:text-border"
            >
              <LegalInline text={item} />
            </li>
          ))}
        </ol>
      );

    case "table":
      return (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            {block.caption ? (
              <caption className="pb-3 text-left text-sm text-muted-foreground">
                {block.caption}
              </caption>
            ) : null}
            <thead>
              <tr className="border-b border-border">
                {block.headers.map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className="py-2.5 pr-4 align-bottom text-xs font-semibold uppercase tracking-wide text-foreground"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className="py-3 pr-4 align-top leading-6 text-muted-foreground"
                    >
                      <LegalInline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "callout":
      return (
        <aside
          className={
            block.tone === "warning"
              ? "rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-5"
              : "rounded-xl border border-border bg-muted/40 p-5"
          }
        >
          <p className="mb-1.5 text-sm font-semibold text-foreground">
            {block.title}
          </p>
          <p className="text-[15px] leading-7 text-muted-foreground">
            <LegalInline text={block.text} />
          </p>
        </aside>
      );
  }
}

interface LegalDocumentPageProps {
  document: LegalDocument;
  /** Set when the reader's locale has no translation and English is being shown. */
  isFallback?: boolean;
  fallbackNotice?: string;
  tableOfContentsLabel?: string;
}

export function LegalDocumentPage({
  document,
  isFallback = false,
  fallbackNotice,
  tableOfContentsLabel = "On this page",
}: LegalDocumentPageProps) {
  return (
    <article className="mx-auto w-full max-w-[760px] px-6 py-16 md:py-24">
      <header className="border-b border-border pb-10">
        <h1 className="font-display text-[34px] font-semibold leading-tight tracking-[-0.02em] text-foreground md:text-[42px]">
          {document.title}
        </h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          {document.summary}
        </p>
        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
          <div className="flex gap-2">
            <dt className="font-medium text-foreground">Effective</dt>
            <dd>
              <time dateTime={document.effectiveDate}>
                {document.effectiveDate}
              </time>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-foreground">Last updated</dt>
            <dd>
              <time dateTime={document.lastUpdated}>
                {document.lastUpdated}
              </time>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-foreground">Version</dt>
            <dd>{document.version}</dd>
          </div>
        </dl>
      </header>

      {isFallback && fallbackNotice ? (
        <p
          role="note"
          className="mt-8 rounded-xl border border-border bg-muted/40 px-5 py-4 text-sm leading-6 text-muted-foreground"
        >
          {fallbackNotice}
        </p>
      ) : null}

      <div className="mt-10 space-y-5">
        {document.intro.map((block, i) => (
          <BlockRenderer key={i} block={block} />
        ))}
      </div>

      <nav
        aria-label={tableOfContentsLabel}
        className="mt-12 rounded-xl border border-border p-6"
      >
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-foreground">
          {tableOfContentsLabel}
        </p>
        <ol className="space-y-2">
          {document.sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="text-sm leading-6 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {section.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-14 space-y-14">
        {document.sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <h2 className="font-display text-[22px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
              {section.heading}
            </h2>
            <div className="mt-5 space-y-5">
              {section.blocks.map((block, i) => (
                <BlockRenderer key={i} block={block} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
