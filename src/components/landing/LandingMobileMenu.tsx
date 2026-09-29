"use client";

import { useRef } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LanguageSwitcherFull } from "@/components/LanguageSwitcher";
import { ThemeToggleSimple } from "@/components/ui/ThemeToggle";
import { localizedHref } from "./links";

export const SECTION_LINKS = [
  { href: "#features", key: "features" },
  { href: "#how", key: "how" },
  { href: "#pricing", key: "pricing" },
  { href: "#faq", key: "faq" },
] as const;

interface MobileMenuTriggerProps {
  open: boolean;
}

/**
 * Menu / close toggle shown in the nav bar below 1041px. Must render inside
 * the nav's `Dialog.Root`; Radix wires `aria-expanded` and `aria-controls`.
 */
export function MobileMenuTrigger({ open }: MobileMenuTriggerProps) {
  const t = useTranslations("landing.nav");
  const Icon = open ? X : Menu;

  return (
    <Dialog.Trigger asChild>
      <button
        type="button"
        aria-label={open ? t("closeMenu") : t("openMenu")}
        className="grid size-9 shrink-0 place-items-center rounded-full border border-lp-line text-lp-fg transition-colors duration-150 hover:border-lp-fg hover:bg-lp-bg-soft min-[1041px]:hidden"
      >
        <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </Dialog.Trigger>
  );
}

interface MobileMenuPanelProps {
  onNavigate: () => void;
}

/**
 * Disclosure panel under the sticky nav (below 1041px): section links, Sign in,
 * language and theme. A non-modal, non-portaled Radix Dialog, so it stays inside
 * the `.landing` token scope, keeps the bar's toggle clickable, closes on Escape,
 * outside click or focus leaving it, and returns focus to the toggle — except
 * after following a link, where focus moves on with the navigation.
 */
export function MobileMenuPanel({ onNavigate }: MobileMenuPanelProps) {
  const t = useTranslations("landing.nav");
  const locale = useLocale();
  const followedLinkRef = useRef(false);

  const handleNavigate = () => {
    followedLinkRef.current = true;
    onNavigate();
  };

  return (
    <Dialog.Content
      aria-describedby={undefined}
      onOpenAutoFocus={(event) => {
        // Radix skips links when picking the first focus target; start on the
        // first section link rather than the language switcher.
        event.preventDefault();
        (event.currentTarget as HTMLElement).querySelector("a")?.focus();
      }}
      onCloseAutoFocus={(event) => {
        if (followedLinkRef.current) {
          event.preventDefault();
          followedLinkRef.current = false;
        }
      }}
      className="absolute inset-x-0 top-full max-h-[calc(100dvh-68px)] overflow-y-auto border-b border-lp-line bg-lp-bg shadow-(--lp-card-shadow) min-[1041px]:hidden"
    >
      <Dialog.Title className="sr-only">{t("menu")}</Dialog.Title>
      <div className="mx-auto max-w-[1180px] px-8 pt-2 pb-7 max-[401px]:px-4 max-[481px]:px-5">
        <ul>
          {SECTION_LINKS.map((link) => (
            <li key={link.key} className="border-b border-lp-line-soft">
              <a
                href={link.href}
                onClick={handleNavigate}
                className="block py-3.5 text-[17px] text-lp-fg transition-colors duration-150 hover:text-lp-primary"
              >
                {t(link.key)}
              </a>
            </li>
          ))}
        </ul>

        <Link
          href={localizedHref(locale, "/sign-in")}
          onClick={handleNavigate}
          className="mt-6 block w-full rounded-full border border-lp-line px-[18px] py-3 text-center text-[15px] font-medium text-lp-fg transition-colors duration-150 hover:border-lp-fg hover:bg-lp-bg-soft"
        >
          {t("signIn")}
        </Link>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 text-[14px] text-lp-fg-soft">
          <div className="flex items-center gap-3">
            <span>{t("language")}</span>
            <LanguageSwitcherFull className="h-9 rounded-full border-lp-line bg-transparent text-[13px] text-lp-fg-soft shadow-none hover:bg-lp-bg-soft hover:text-lp-fg dark:border-lp-line dark:bg-transparent dark:hover:bg-lp-bg-soft" />
          </div>
          <div className="flex items-center gap-3">
            <span>{t("theme")}</span>
            <ThemeToggleSimple size="md" className="border border-lp-line" />
          </div>
        </div>
      </div>
    </Dialog.Content>
  );
}
