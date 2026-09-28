import { getLocale, getTranslations } from "next-intl/server";
import { LogoSymbol } from "@/components/chat/LogoSymbol";
import { cn } from "@/lib/utils";

const NAV_KEYS = ["thisWeek", "recipes", "mealPlans", "shoppingList"] as const;

const SAVED_PLANS = [
  { key: "highProtein", dot: "bg-lp-coral-soft" },
  { key: "mediterranean", dot: "bg-lp-sage" },
  { key: "quick", dot: "bg-lp-gold-soft" },
] as const;

/** Day-of-month shown under each weekday; the mock's "today" is the third day. */
const FIRST_DAY = 3;
const TODAY_INDEX = 2;

const MEALS = [
  { key: "breakfast", kcal: 480, protein: 32, thumb: "bg-lp-coral-tint" },
  { key: "lunch", kcal: 620, protein: 38, thumb: "bg-lp-sage-tint" },
  { key: "dinner", kcal: 540, protein: 42, thumb: "bg-lp-gold-tint" },
] as const;

const MACROS = [
  { key: "protein", grams: 112, swatch: "bg-lp-coral" },
  { key: "carbs", grams: 184, swatch: "bg-lp-sage" },
  { key: "fat", grams: 62, swatch: "bg-lp-gold-soft" },
] as const;

const CALORIE_PROGRESS = 0.68;

const miniLabel = "font-lp-mono uppercase text-lp-muted";

/** Monday-first narrow weekday names in the locale (en `M T W…`, es `L M X…`, pl `P W Ś…`). */
function weekdayInitials(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" });
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, i) => format.format(new Date(Date.UTC(2024, 0, 1 + i))));
}

/**
 * Static, decorative preview of the weekly planner shown in the hero. Hidden
 * from assistive tech: the hero copy already says what it illustrates.
 */
export async function ProductMock() {
  const [t, tUnits, locale] = await Promise.all([
    getTranslations("landing.productMock"),
    getTranslations("landing.units"),
    getLocale(),
  ]);
  const weekdays = weekdayInitials(locale);

  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-[18px] border border-lp-line bg-lp-card shadow-(--lp-frame-shadow)"
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-lp-line-soft bg-lp-bg px-[18px] py-3.5">
        <span className="size-2.5 shrink-0 rounded-full bg-lp-line" />
        <span className="size-2.5 shrink-0 rounded-full bg-lp-line" />
        <span className="size-2.5 shrink-0 rounded-full bg-lp-line" />
        <span className="ml-3.5 truncate font-lp-mono text-[11px] text-lp-muted">{t("path")}</span>
      </div>

      <div className="grid h-[540px] grid-cols-[240px_1fr_320px] bg-lp-bg max-[901px]:h-auto max-[901px]:grid-cols-1">
        {/* Sidebar */}
        <div className="border-r border-lp-line-soft bg-lp-bg px-[18px] py-[22px] max-[901px]:hidden">
          <div className="mb-7 flex items-center gap-2 px-2.5 font-lp-display text-[16px] font-semibold text-lp-fg">
            <LogoSymbol size={22} />
            DietAI
          </div>
          <div className="flex flex-col gap-1">
            {NAV_KEYS.map((key, i) => (
              <div
                key={key}
                className={cn(
                  "flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] text-lp-fg-soft",
                  i === 0 && "bg-lp-bg-soft font-medium text-lp-fg"
                )}
              >
                <span className={cn("size-2 shrink-0 rounded-full", i === 0 ? "bg-lp-primary" : "bg-lp-line")} />
                {t(`nav.${key}`)}
              </div>
            ))}
          </div>
          <div className={cn(miniLabel, "mx-2.5 mt-[22px] mb-2 text-[10px] tracking-[0.12em]")}>
            {t("savedPlans.label")}
          </div>
          <div className="flex flex-col gap-1">
            {SAVED_PLANS.map((plan) => (
              <div
                key={plan.key}
                className="flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] text-lp-fg-soft"
              >
                <span className={cn("size-2 shrink-0 rounded-full", plan.dot)} />
                {t(`savedPlans.${plan.key}`)}
              </div>
            ))}
          </div>
        </div>

        {/* Main: week + meals */}
        <div className="overflow-hidden px-8 py-7 max-[901px]:p-[22px]">
          <div className="mb-1 font-lp-display text-[26px] font-medium tracking-[-0.015em]">{t("title")}</div>
          <div className="mb-6 text-[12px] text-lp-muted">{t("subtitle")}</div>
          <div className="mb-[22px] grid grid-cols-7 gap-1.5">
            {weekdays.map((day, i) => {
              const isToday = i === TODAY_INDEX;
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-[76px] rounded-[8px] border px-2 py-2.5 max-[481px]:min-h-[64px] max-[481px]:px-1.5",
                    isToday ? "border-transparent bg-lp-primary-tint" : "border-lp-line-soft bg-lp-card"
                  )}
                >
                  <div className={cn(miniLabel, "mb-1.5 text-[9px] tracking-[0.1em]", isToday && "text-lp-primary")}>
                    {day}
                  </div>
                  <div className="font-lp-display text-[18px]">{FIRST_DAY + i}</div>
                  <div className={cn("mt-1.5 h-1 rounded-[2px]", isToday ? "bg-lp-primary" : "bg-lp-bg-soft")} />
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-2">
            {MEALS.map((meal) => (
              <div
                key={meal.key}
                className="flex items-center justify-between gap-3 rounded-[10px] border border-lp-line-soft bg-lp-card px-3.5 py-3 max-[561px]:flex-col max-[561px]:items-start"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cn("size-9 shrink-0 rounded-[8px]", meal.thumb)} />
                  <div className="min-w-0">
                    <div className={cn(miniLabel, "mb-0.5 text-[9px] tracking-[0.1em]")}>
                      {t(`meals.${meal.key}.slot`)}
                    </div>
                    <div className="text-[13px] font-medium">{t(`meals.${meal.key}.name`)}</div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-3 text-[11px] max-[561px]:pl-12">
                  <b className="font-medium whitespace-nowrap text-lp-fg">{tUnits("kcal", { value: meal.kcal })}</b>
                  <b className="font-medium whitespace-nowrap text-lp-fg">{t("protein", { value: meal.protein })}</b>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Aside: nutrition + assistant */}
        <div className="flex flex-col gap-[18px] overflow-hidden border-l border-lp-line-soft bg-lp-bg px-[22px] py-6 max-[901px]:hidden">
          <div className="rounded-[12px] border border-lp-line-soft bg-lp-card p-[18px]">
            <div className={cn(miniLabel, "mb-3.5 text-[10px] tracking-[0.12em]")}>{t("nutritionTitle")}</div>
            <div className="flex items-center gap-4">
              <div className="flex w-[84px] shrink-0 flex-col items-center gap-1.5">
                <div
                  className="grid size-[72px] place-items-center rounded-full"
                  style={{
                    background: `conic-gradient(var(--lp-primary) 0 ${CALORIE_PROGRESS * 100}%, var(--lp-bg-soft) 0)`,
                  }}
                >
                  <span className="col-start-1 row-start-1 size-[52px] rounded-full bg-lp-card" />
                  <span className="z-[1] col-start-1 row-start-1 font-lp-display text-[17px] font-medium">
                    {tUnits("percent", { value: CALORIE_PROGRESS })}
                  </span>
                </div>
                <span className="text-center text-[10px] leading-[1.3] text-lp-muted">{t("donutCaption")}</span>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5 text-[12px]">
                {MACROS.map((macro) => (
                  <div key={macro.key} className="flex items-center gap-2">
                    <span className={cn("size-2 shrink-0 rounded-[2px]", macro.swatch)} />
                    <span className="truncate">
                      {t(`macros.${macro.key}`)} · {tUnits("grams", { value: macro.grams })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-[12px] bg-lp-ink p-3.5 text-lp-ink-fg">
            <div className="grid size-6 shrink-0 place-items-center rounded-full bg-lp-primary">
              <LogoSymbol size={16} tone="light" />
            </div>
            <div className="text-[12px] leading-[1.5] text-lp-ink-fg/85">
              {t.rich("assistantMessage", {
                strong: (chunks) => <b className="font-medium text-lp-ink-fg">{chunks}</b>,
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
