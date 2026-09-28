import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { SectionHead } from "../ui/SectionHead";
import { AssistantVisual, ImportVisual, NutritionVisual, ShoppingVisual } from "../ui/visuals";

const FEATURES = [
  { key: "import", points: ["sources", "servings", "sharing"], Visual: ImportVisual },
  { key: "nutrition", points: ["nutrients", "targets", "totals"], Visual: NutritionVisual },
  { key: "shopping", points: ["scheduled", "export", "cart"], Visual: ShoppingVisual },
  { key: "assistant", points: ["recipes", "plan", "photos"], Visual: AssistantVisual },
] as const;

export async function FeaturesSection() {
  const t = await getTranslations("landing.features");

  return (
    <section id="features" className="scroll-mt-[68px] py-16">
      <div className="mx-auto max-w-[1180px] px-8">
        <SectionHead
          eyebrow={t("eyebrow")}
          title={t.rich("title", { em: (chunks) => <em>{chunks}</em> })}
          rhs={t("rhs")}
        />

        {FEATURES.map(({ key, points, Visual }, i) => {
          // Zig-zag: every second row puts the visual on the left on wide
          // screens. The DOM stays text-first, so narrow screens read the copy
          // before the illustration.
          const visualFirst = i % 2 === 1;

          return (
            <div
              key={key}
              className="grid grid-cols-2 items-center gap-20 border-t border-lp-line py-14 last:border-b max-[801px]:grid-cols-1 max-[801px]:gap-8"
            >
              <div>
                <h3 className="mb-[18px] max-w-[14ch] font-lp-display text-[38px] font-medium leading-[1.1] tracking-[-0.015em] text-lp-fg">
                  {t(`items.${key}.title`)}
                </h3>
                <p className="max-w-[42ch] text-[16px] leading-[1.65] text-lp-fg-soft">{t(`items.${key}.body`)}</p>
                <ul className="mt-6 flex flex-col gap-2.5">
                  {points.map((point) => (
                    <li
                      key={point}
                      className="flex items-center gap-2.5 text-[14px] text-lp-fg-soft before:size-1.5 before:shrink-0 before:rounded-full before:bg-lp-primary"
                    >
                      {t(`items.${key}.points.${point}`)}
                    </li>
                  ))}
                </ul>
              </div>
              {/* No overflow-hidden: the aspect ratio then acts as a minimum and the
                  frame grows with its mock instead of clipping it on narrow columns. */}
              <div
                aria-hidden="true"
                className={cn(
                  "lp-dots flex aspect-[4/3.2] items-center justify-center rounded-[14px] border border-lp-line p-8 max-[481px]:px-4 max-[481px]:py-6",
                  visualFirst && "order-first max-[801px]:order-none"
                )}
              >
                <Visual />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
