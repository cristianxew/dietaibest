import { Check, FileDown, ShoppingCart } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

const GROUPS = [
  {
    key: "vegetables",
    items: [
      { key: "tomatoes", value: 500, checked: true },
      { key: "spinach", value: 200, checked: false },
      { key: "zucchini", value: 400, checked: false },
    ],
  },
  {
    key: "proteins",
    items: [
      { key: "salmon", value: 600, checked: false },
      { key: "chicken", value: 500, checked: false },
    ],
  },
  {
    key: "dairy",
    items: [
      { key: "yogurt", value: 500, checked: false },
      { key: "parmesan", value: 80, checked: false },
    ],
  },
] as const;

const pill =
  "inline-flex items-center gap-1.5 rounded-full border border-lp-line bg-lp-bg px-2.5 py-1 font-lp-mono text-[10px] text-lp-fg-soft";

/** Feature visual: a category-grouped shopping list with export and cart options. */
export async function ShoppingVisual() {
  const [t, tUnits] = await Promise.all([
    getTranslations("landing.visuals.shopping"),
    getTranslations("landing.units"),
  ]);

  return (
    <div className="w-full max-w-[340px] rounded-[12px] border border-lp-line-soft bg-lp-card p-5 shadow-(--lp-card-shadow)">
      <div className="mb-3 font-lp-display text-[18px] font-medium tracking-[-0.01em] text-lp-fg">{t("title")}</div>

      <div className="flex flex-col gap-3">
        {GROUPS.map((group) => (
          <div key={group.key}>
            <div className="mb-1 font-lp-mono text-[9px] uppercase tracking-[0.12em] text-lp-muted">
              {t(`categories.${group.key}`)}
            </div>
            <ul>
              {group.items.map((item) => (
                <li key={item.key} className="flex items-center gap-2.5 py-1 text-[12px]">
                  <span
                    className={cn(
                      "grid size-3.5 shrink-0 place-items-center rounded-[4px] border",
                      item.checked ? "border-lp-primary bg-lp-primary text-lp-card" : "border-lp-line"
                    )}
                  >
                    {item.checked ? <Check className="size-2.5" strokeWidth={3} /> : null}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      item.checked ? "text-lp-muted line-through" : "text-lp-fg"
                    )}
                  >
                    {t(`items.${item.key}`)}
                  </span>
                  <span className="shrink-0 font-lp-mono text-[11px] text-lp-fg-soft">
                    {tUnits("grams", { value: item.value })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-lp-line-soft pt-3">
        <span className={pill}>
          <FileDown className="size-3 shrink-0" strokeWidth={2} />
          {t("pdf")}
        </span>
        <span className={pill}>
          <ShoppingCart className="size-3 shrink-0" strokeWidth={2} />
          {t("stores")}
        </span>
      </div>
    </div>
  );
}
