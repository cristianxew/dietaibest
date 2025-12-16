import { useTranslations } from "next-intl";
import { Settings } from "lucide-react";
import { StoreSelector } from "@/components/shopping";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const t = useTranslations("navigation.settingsHeader");

  return (
    <div className="min-h-screen relative">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-100/30 dark:bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-gold-100/20 dark:bg-gold-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative p-6 lg:p-8 space-y-8">
        {/* Hero Header */}
        <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-end">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 dark:from-brand-500/20 dark:to-brand-500/10 border border-brand-200/50 dark:border-brand-500/20">
                <Settings className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-widest">
                {t("section")}
              </span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-display font-bold text-foreground tracking-tight">
              {t("title")}
            </h1>
            <p className="text-muted-foreground max-w-lg leading-relaxed">
              {t("subtitle")}
            </p>
          </div>
        </div>

        {/* Settings Content */}
        <div className="space-y-6">
          <StoreSelector />
        </div>
      </div>
    </div>
  );
}
