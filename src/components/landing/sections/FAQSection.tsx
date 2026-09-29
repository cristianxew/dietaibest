import { getTranslations } from "next-intl/server";
import { getTrialDays } from "@/lib/stripe-helpers";
import { SectionHead } from "../ui/SectionHead";
import { FAQAccordion, type FAQItem } from "./FAQAccordion";

const ITEM_KEYS = [
  "nutritionSource",
  "import",
  "stores",
  "freePlan",
  "trial",
  "medical",
  "languages",
] as const;

export async function FAQSection() {
  const t = await getTranslations("landing.faq");
  const days = getTrialDays();

  const items: FAQItem[] = ITEM_KEYS.map((key) => ({
    question: t(`items.${key}.q`),
    answer: t(`items.${key}.a`, { days }),
  }));

  return (
    <section id="faq" className="scroll-mt-[68px] py-16">
      <div className="mx-auto max-w-[1180px] px-8">
        <SectionHead eyebrow={t("eyebrow")} title={t.rich("title", { em: (chunks) => <em>{chunks}</em> })} />
        <FAQAccordion items={items} />
      </div>
    </section>
  );
}
