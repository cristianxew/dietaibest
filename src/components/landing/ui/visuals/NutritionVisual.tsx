import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

/** Per-serving amounts and their share of the personal daily target. */
const NUTRIENTS = [
  { key: "protein", unit: "grams", value: 32, share: 0.23, bar: "bg-lp-coral" },
  { key: "fiber", unit: "grams", value: 9, share: 0.32, bar: "bg-lp-sage" },
  { key: "iron", unit: "milligrams", value: 4.1, share: 0.23, bar: "bg-lp-gold" },
  { key: "vitaminD", unit: "micrograms", value: 3.2, share: 0.21, bar: "bg-lp-gold-soft" },
  { key: "calcium", unit: "milligrams", value: 280, share: 0.28, bar: "bg-lp-primary" },
] as const;

const miniLabel = "font-lp-mono text-[10px] uppercase tracking-[0.12em] text-lp-muted";

/** Feature visual: a per-serving nutrient panel measured against targets. */
export async function NutritionVisual() {
  const [t, tUnits] = await Promise.all([
    getTranslations("landing.visuals.nutrition"),
    getTranslations("landing.units"),
  ]);

  return (
    <div className="w-full max-w-[340px] rounded-[12px] border border-lp-line-soft bg-lp-card p-5 shadow-(--lp-card-shadow)">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <span className={miniLabel}>{t("title")}</span>
        <span className={cn(miniLabel, "text-right")}>{t("targetColumn")}</span>
      </div>

      <ul className="flex flex-col gap-3.5">
        {NUTRIENTS.map((nutrient) => (
          <li key={nutrient.key}>
            <div className="flex items-baseline justify-between gap-3 text-[12px]">
              <span className="min-w-0 truncate text-lp-fg">{t(`nutrients.${nutrient.key}`)}</span>
              <span className="flex shrink-0 items-baseline gap-3 font-lp-mono">
                <span className="text-[11px] text-lp-fg-soft">
                  {tUnits(nutrient.unit, { value: nutrient.value })}
                </span>
                <span className="w-9 text-right text-[11px] text-lp-fg">
                  {tUnits("percent", { value: nutrient.share })}
                </span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-lp-bg-soft">
              <div
                className={cn("h-full rounded-full", nutrient.bar)}
                style={{ width: `${nutrient.share * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-5 border-t border-lp-line-soft pt-3 font-lp-mono text-[10px] tracking-[0.04em] text-lp-muted">
        {t("source")}
      </div>
    </div>
  );
}
