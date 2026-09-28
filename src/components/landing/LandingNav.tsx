"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { LanguageSwitcherCompact } from "@/components/LanguageSwitcher";
import { ThemeToggleSimple } from "@/components/ui/ThemeToggle";
import { MobileMenuPanel, MobileMenuTrigger, SECTION_LINKS } from "./LandingMobileMenu";
import { localizedHref } from "./links";
import { BrandLogo } from "./ui/BrandLogo";
import { LandingButton } from "./ui/LandingButton";

/**
 * Sticky landing nav. ≥1041px: logo, section links, language, theme, Sign in,
 * Start free. Below that the bar keeps only the logo, Start free and a menu
 * toggle; everything else moves into the mobile menu panel.
 */
export function LandingNav() {
  const t = useTranslations("landing.nav");
  const locale = useLocale();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll(); // sync on mount (e.g. reload mid-page)
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
      <nav
        className={cn(
          "sticky top-0 z-50 border-b border-transparent bg-lp-bg/78 backdrop-blur-[14px] backdrop-saturate-140 transition-[border-color,background-color] duration-[250ms]",
          (scrolled || menuOpen) && "border-lp-line",
          menuOpen && "bg-lp-bg"
        )}
      >
        <div className="mx-auto flex h-[68px] max-w-[1180px] items-center justify-between gap-4 px-8 max-[481px]:gap-3 max-[481px]:px-5 max-[401px]:px-4">
          <Link href={localizedHref(locale, "/")} aria-label={t("home")} className="flex shrink-0">
            <BrandLogo priority className="max-[521px]:h-8 max-[361px]:h-7" />
          </Link>

          <div className="flex items-center gap-9 text-[14px] text-lp-fg-soft max-[1041px]:hidden">
            {SECTION_LINKS.map((link) => (
              <a
                key={link.key}
                href={link.href}
                className="whitespace-nowrap transition-colors duration-150 hover:text-lp-fg"
              >
                {t(link.key)}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-[18px] text-[14px] max-[1041px]:gap-2">
            <LanguageSwitcherCompact className="h-8 rounded-full px-2.5 text-lp-fg-soft hover:bg-lp-bg-soft hover:text-lp-fg dark:hover:bg-lp-bg-soft max-[1041px]:hidden" />
            <ThemeToggleSimple size="sm" className="max-[1041px]:hidden" />
            <Link
              href={localizedHref(locale, "/sign-in")}
              className="whitespace-nowrap text-lp-fg-soft hover:text-lp-fg max-[1041px]:hidden"
            >
              {t("signIn")}
            </Link>
            <LandingButton
              href={localizedHref(locale, "/sign-up")}
              className="max-[481px]:px-3.5 max-[481px]:text-[13px]"
            >
              {t("startFree")}
            </LandingButton>
            <MobileMenuTrigger open={menuOpen} />
          </div>
        </div>

        <MobileMenuPanel onNavigate={() => setMenuOpen(false)} />
      </nav>
    </Dialog.Root>
  );
}
