import { getTranslations } from "next-intl/server";
import { SectionHead } from "../ui/SectionHead";

const STEP_KEYS = ["goals", "week", "shop"] as const;

export async function HowItWorks() {
  const t = await getTranslations("landing.how");

  return (
    <section id="how" className="scroll-mt-[68px] py-16">
      <div className="mx-auto max-w-[1180px] px-8">
        <SectionHead
          eyebrow={t("eyebrow")}
          title={t.rich("title", { em: (chunks) => <em>{chunks}</em> })}
          rhs={t("rhs")}
        />
        <ol className="grid grid-cols-3 border-t border-lp-line max-[801px]:grid-cols-1">
          {STEP_KEYS.map((key, i) => (
            <li
              key={key}
              className="relative border-r border-lp-line pt-10 pr-8 pb-9 not-first:pl-8 last:border-r-0 last:pr-0 max-[801px]:border-r-0 max-[801px]:border-b max-[801px]:px-0! max-[801px]:py-8! max-[801px]:last:border-b-0"
            >
              <div className="mb-8 font-lp-mono text-[11px] tracking-[0.16em] text-lp-muted">
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3 className="mb-3.5 font-lp-display text-[26px] font-medium leading-[1.15] tracking-[-0.01em] text-lp-fg">
                {t(`steps.${key}.title`)}
              </h3>
              <p className="text-[15px] leading-[1.6] text-lp-fg-soft">{t(`steps.${key}.body`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
