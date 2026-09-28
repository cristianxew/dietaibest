import { ArrowDown, Link2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

const INGREDIENTS = [
  { key: "pasta", unit: "grams", value: 320 },
  { key: "tomatoes", unit: "grams", value: 400 },
  { key: "cream", unit: "milliliters", value: 120 },
  { key: "parmesan", unit: "grams", value: 40 },
] as const;

/** Feature visual: a pasted video link turning into an editable recipe card. */
export async function ImportVisual() {
  const [t, tUnits] = await Promise.all([
    getTranslations("landing.visuals.import"),
    getTranslations("landing.units"),
  ]);

  return (
    <div className="flex w-full max-w-[340px] flex-col gap-3">
      <div className="flex items-center gap-2.5 rounded-full border border-lp-line bg-lp-card px-4 py-2.5 shadow-(--lp-card-shadow)">
        <Link2 className="size-3.5 shrink-0 text-lp-muted" strokeWidth={2} />
        <span className="truncate font-lp-mono text-[12px] text-lp-fg-soft">{t("url")}</span>
      </div>

      <ArrowDown className="mx-auto size-4 text-lp-primary" strokeWidth={2} />

      <div className="rounded-[12px] border border-lp-line-soft bg-lp-card p-4 shadow-(--lp-card-shadow)">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
          <div className="min-w-0 font-lp-display text-[18px] font-medium leading-[1.2] tracking-[-0.01em] text-lp-fg">
            {t("recipeTitle")}
          </div>
          <span className="shrink-0 rounded-full bg-lp-primary-tint px-2 py-0.5 font-lp-mono text-[9px] uppercase tracking-[0.1em] text-lp-primary">
            {t("imported")}
          </span>
        </div>
        <span className="mt-2.5 inline-block rounded-full border border-lp-line px-2.5 py-0.5 font-lp-mono text-[10px] text-lp-fg-soft">
          {t("servings")}
        </span>
        <ul className="mt-3 divide-y divide-lp-line-soft">
          {INGREDIENTS.map((ingredient) => (
            <li key={ingredient.key} className="flex items-center justify-between gap-3 py-1.5 text-[12px]">
              <span className="min-w-0 truncate text-lp-fg-soft">{t(`ingredients.${ingredient.key}`)}</span>
              <span className="shrink-0 font-lp-mono text-[11px] text-lp-fg">
                {tUnits(ingredient.unit, { value: ingredient.value })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
