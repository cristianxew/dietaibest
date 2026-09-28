import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { LanguageSwitcherFull } from "@/components/LanguageSwitcher";
import { localizedHref } from "./links";
import { BrandLogo } from "./ui/BrandLogo";

interface FooterLink {
  label: string;
  /** In-page `#anchor` or a locale-prefixed route. */
  href: string;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

const linkClass = "text-[14px] text-lp-fg-soft transition-colors duration-150 hover:text-lp-fg";

export async function LandingFooter() {
  const [t, tNav, locale] = await Promise.all([
    getTranslations("landing.footer"),
    getTranslations("landing.nav"),
    getLocale(),
  ]);
  const year = new Date().getFullYear();

  const columns: FooterColumn[] = [
    {
      title: t("columns.product"),
      links: [
        { label: tNav("features"), href: "#features" },
        { label: tNav("how"), href: "#how" },
        { label: tNav("pricing"), href: "#pricing" },
        { label: tNav("faq"), href: "#faq" },
      ],
    },
    {
      title: t("columns.account"),
      links: [
        { label: t("links.signIn"), href: localizedHref(locale, "/sign-in") },
        { label: t("links.signUp"), href: localizedHref(locale, "/sign-up") },
      ],
    },
    {
      title: t("columns.legal"),
      links: [
        { label: t("links.privacy"), href: localizedHref(locale, "/privacy") },
        { label: t("links.terms"), href: localizedHref(locale, "/terms") },
        { label: t("links.cookies"), href: localizedHref(locale, "/cookies") },
      ],
    },
  ];

  return (
    <footer className="border-t border-lp-line pt-12 pb-16">
      <div className="mx-auto max-w-[1180px] px-8">
        <div className="mb-12 grid grid-cols-[2fr_1fr_1fr_1fr] gap-12 max-[801px]:grid-cols-2 max-[481px]:grid-cols-1 max-[481px]:gap-10">
          <div className="max-[801px]:col-span-2 max-[481px]:col-span-1">
            <Link href={localizedHref(locale, "/")} aria-label={tNav("home")} className="inline-flex">
              <BrandLogo className="h-9" />
            </Link>
            <p className="mt-4 max-w-[36ch] text-[14px] leading-[1.6] text-lp-fg-soft">{t("blurb")}</p>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <h4 className="mb-[18px] font-lp-mono text-[11px] font-medium uppercase leading-[1.5] tracking-[0.12em] text-lp-muted">
                {column.title}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    {link.href.startsWith("#") ? (
                      <a href={link.href} className={linkClass}>
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className={linkClass}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-lp-line pt-6 text-[13px] text-lp-muted">
          <span>{t("copyright", { year })}</span>
          <LanguageSwitcherFull className="h-9 rounded-full border-lp-line bg-transparent text-[13px] text-lp-fg-soft shadow-none hover:bg-lp-bg-soft hover:text-lp-fg dark:border-lp-line dark:bg-transparent dark:hover:bg-lp-bg-soft" />
        </div>
      </div>
    </footer>
  );
}
