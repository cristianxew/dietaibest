import { getTranslations } from "next-intl/server";
import { LogoSymbol } from "@/components/chat/LogoSymbol";

/** Feature visual: one plan edit requested in plain language and its result. */
export async function AssistantVisual() {
  const t = await getTranslations("landing.visuals.assistant");

  return (
    <div className="w-full max-w-[340px] rounded-[12px] border border-lp-line-soft bg-lp-card p-5 shadow-(--lp-card-shadow)">
      <div className="mb-4 flex items-center gap-2 border-b border-lp-line-soft pb-3">
        <LogoSymbol size={18} />
        <span className="font-lp-mono text-[10px] uppercase tracking-[0.12em] text-lp-muted">{t("label")}</span>
        <span className="ml-auto size-1.5 rounded-full bg-lp-primary" />
      </div>

      <div className="flex flex-col gap-3 text-[12.5px] leading-[1.5]">
        <p className="ml-auto max-w-[85%] rounded-[14px] rounded-br-[4px] bg-lp-primary-tint px-3.5 py-2.5 text-lp-fg">
          {t("userMessage")}
        </p>
        <div className="flex items-end gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-lp-primary">
            <LogoSymbol size={15} tone="light" />
          </span>
          <p className="max-w-[85%] rounded-[14px] rounded-bl-[4px] bg-lp-bg-soft px-3.5 py-2.5 text-lp-fg">
            {t("reply")}
          </p>
        </div>
      </div>
    </div>
  );
}
