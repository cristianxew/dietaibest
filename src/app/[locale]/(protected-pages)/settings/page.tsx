import { useTranslations } from "next-intl";
import { StoreSelector } from "@/components/shopping";

export default function SettingsPage() {
  const t = useTranslations("navigation.userMenu");

  return (
    <div className="min-h-screen relative">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-100/30 dark:bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-gold-100/20 dark:bg-gold-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative p-6 lg:p-8 space-y-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {t("accountSettings")}
        </h1>

        {/* Shopping Store Preferences */}
        <StoreSelector />
      </div>
    </div>
  );
}
