import { LockKeyhole } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

/**
 * Inline badge shown next to Pro-gated features.
 * Use in both server and client components.
 */
export function ProBadge() {
  const t = useTranslations("billing");
  return (
    <Badge
      variant="secondary"
      className="gap-1 py-0 px-1.5 text-[10px] font-semibold uppercase tracking-wide"
    >
      <LockKeyhole className="size-2.5" aria-hidden />
      {t("proBadge")}
    </Badge>
  );
}
