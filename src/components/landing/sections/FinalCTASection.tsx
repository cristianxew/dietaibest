import { getLocale, getTranslations } from "next-intl/server";
import { localizedHref } from "../links";
import { LandingButton } from "../ui/LandingButton";

export async function FinalCTASection() {
  const [t, locale] = await Promise.all([getTranslations("landing.finalCta"), getLocale()]);

  return (
    <section className="py-16">
      <div className="mx-auto max-w-[1180px] px-8">
        <div className="relative mb-16 overflow-hidden rounded-[24px] border border-lp-ink-line bg-lp-ink px-16 py-24 text-center text-lp-ink-fg max-[701px]:px-6 max-[701px]:py-14">
          {/* Warm glow rising from the bottom edge */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_600px_300px_at_50%_110%,color-mix(in_oklab,var(--lp-coral-soft)_28%,transparent),transparent_70%)]"
          />
          <h2 className="relative mx-auto max-w-[18ch] font-lp-display text-[clamp(36px,5.5vw,64px)] font-medium leading-[1.05] tracking-[-0.02em] text-lp-ink-fg">
            {t.rich("title", {
              em: (chunks) => <em className="italic text-lp-primary-soft">{chunks}</em>,
            })}
          </h2>
          <p className="relative mx-auto mt-5 max-w-[48ch] text-[17px] text-lp-ink-fg/70">{t("sub")}</p>
          <div className="relative mt-9 flex flex-wrap justify-center gap-3">
            <LandingButton href={localizedHref(locale, "/sign-up")} onInk>
              {t("primaryCta")}
            </LandingButton>
            <LandingButton href="#pricing" variant="ghost" onInk>
              {t("secondaryCta")}
            </LandingButton>
          </div>
        </div>
      </div>
    </section>
  );
}
