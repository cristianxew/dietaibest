import { useTranslations } from "next-intl";
import { StoreSelector } from "@/components/shopping";
import { PageContainer } from "@/components/ui/page-container";
import { SettingsBilling } from "@/components/billing/SettingsBilling";

export default function SettingsPage() {
  const t = useTranslations("navigation.settingsHeader");

  return (
    <div className="min-h-screen relative">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-100/30 dark:bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-gold-100/20 dark:bg-gold-500/5 rounded-full blur-3xl" />
      </div>

      <PageContainer className="space-y-8">
        {/* Hero Header */}
        <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-end">
          <div className="space-y-3">
            <h1 className="text-3xl lg:text-[2rem] font-display font-bold text-foreground tracking-tight">
              {t("title")}
            </h1>
            <p className="text-muted-foreground max-w-lg leading-relaxed">
              {t("subtitle")}
            </p>
          </div>
        </div>

        {/* Settings Content */}
        <div className="space-y-6">
          <SettingsBilling />
          <StoreSelector />
        </div>
      </PageContainer>
    </div>
  );
}
