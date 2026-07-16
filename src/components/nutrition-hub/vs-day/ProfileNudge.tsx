"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { UserPen, ArrowRight } from "lucide-react";

/** Banner shown when targets fall back to generic FDA values. */
export function ProfileNudge() {
  const t = useTranslations("nutritionHub.vsDay.nudge");

  return (
    <Link
      href="/profile"
      className="group flex items-center gap-3 rounded-2xl border border-gold-200 dark:border-gold-500/20 bg-gold-50/60 dark:bg-gold-500/10 px-4 py-3 transition-colors hover:bg-gold-50 dark:hover:bg-gold-500/15"
    >
      <UserPen className="w-4 h-4 text-gold-600 dark:text-gold-400 shrink-0" />
      <p className="text-sm text-gold-700 dark:text-gold-300 flex-1">
        {t("message")}
      </p>
      <span className="inline-flex items-center gap-1 text-sm font-medium text-gold-700 dark:text-gold-300 shrink-0">
        {t("cta")}
        <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
