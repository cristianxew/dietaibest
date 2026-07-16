import { useTranslations } from "next-intl";
import { Info } from "lucide-react";

/** One-line footer used on every Nutrition Hub route. */
export function EducationalDisclaimer() {
  const t = useTranslations("nutritionHub.common");

  return (
    <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/70 pt-4">
      <Info className="w-3 h-3" />
      {t("disclaimer")}
    </p>
  );
}
