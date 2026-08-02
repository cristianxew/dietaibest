import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/**
 * Minimal inline renderer for legal copy.
 *
 * Supports `**bold**`, `[label](href)` and `` `code` ``. Deliberately does not
 * use `dangerouslySetInnerHTML`: legal text is edited often and by people who
 * are not thinking about XSS, so the renderer should make injection impossible
 * rather than merely unlikely.
 */
const INLINE_PATTERN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|`[^`]+`)/g;
const LINK_PATTERN = /^\[([^\]]+)\]\(([^)]+)\)$/;

function renderLink(label: string, href: string, key: number): ReactNode {
  const isInternal = href.startsWith("/");
  const className =
    "font-medium text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors";

  if (isInternal) {
    return (
      <Link key={key} href={href} className={className}>
        {label}
      </Link>
    );
  }

  const isExternalHttp = href.startsWith("http");
  return (
    <a
      key={key}
      href={href}
      className={className}
      {...(isExternalHttp
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      {label}
    </a>
  );
}

export function LegalInline({ text }: { text: string }): ReactNode {
  const parts = text.split(INLINE_PATTERN).filter(Boolean);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          );
        }

        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
            >
              {part.slice(1, -1)}
            </code>
          );
        }

        const link = part.match(LINK_PATTERN);
        if (link) {
          return renderLink(link[1], link[2], i);
        }

        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
