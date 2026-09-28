import { getLocale, getTranslations } from "next-intl/server";
import { localizedHref } from "../links";
import { LandingButton } from "../ui/LandingButton";
import { ProductMock } from "../ui/ProductMock";

const TRUST_KEYS = ["trust.free", "trust.usda", "trust.languages"] as const;

export async function HeroSection() {
  const [t, locale] = await Promise.all([getTranslations("landing.hero"), getLocale()]);

  return (
    <header className="relative isolate pt-24 pb-14">
      <div className="lp-hero-bg" aria-hidden="true">
        <span className="lp-orb lp-orb-1" />
        <span className="lp-orb lp-orb-2" />
        <span className="lp-orb lp-orb-3" />
        <span className="lp-spark lp-spark-1" />
        <span className="lp-spark lp-spark-2" />
        <span className="lp-spark lp-spark-3" />
        <span className="lp-spark lp-spark-4" />
      </div>

      <div className="mx-auto max-w-[1180px] px-8">
        <p className="lp-hero-in mb-7 inline-flex items-center gap-2 font-lp-mono text-[11px] uppercase tracking-[0.16em] text-lp-muted before:h-px before:w-6 before:shrink-0 before:bg-lp-muted">
          {t("eyebrow")}
        </p>
        <h1 className="lp-hero-in max-w-[18ch] font-lp-display text-[clamp(48px,8vw,96px)] font-medium leading-[1.02] tracking-[-0.025em] text-lp-fg">
          {t("titleLead")}
          <br />
          <em className="font-medium italic text-lp-primary">{t("titleAccent")}</em>
        </h1>
        <p className="lp-hero-in lp-hero-in-d1 mt-7 max-w-[52ch] text-[19px] leading-[1.55] text-lp-fg-soft">
          {t("sub")}
        </p>
        <div className="lp-hero-in lp-hero-in-d2 mt-10 flex flex-wrap items-center gap-3">
          <LandingButton href={localizedHref(locale, "/sign-up")}>{t("primaryCta")}</LandingButton>
          <LandingButton href="#how" variant="ghost">
            {t("secondaryCta")}
          </LandingButton>
        </div>
        <ul className="lp-hero-in lp-hero-in-d3 mt-9 flex flex-wrap items-center gap-x-6 gap-y-2.5 text-[13px] text-lp-muted">
          {TRUST_KEYS.map((key) => (
            <li
              key={key}
              className="flex items-center gap-2 before:size-1.5 before:shrink-0 before:rounded-full before:bg-lp-primary"
            >
              {t(key)}
            </li>
          ))}
        </ul>

        <div className="relative mt-20">
          <ProductMock />
        </div>
      </div>
    </header>
  );
}
