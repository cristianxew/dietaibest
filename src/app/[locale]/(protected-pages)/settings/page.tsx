import { useTranslations } from "next-intl";

export default function SettingsPage() {
  const t = useTranslations("navigation.userMenu");

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
        {t("accountSettings")}
      </h1>
    </div>
  );
}
