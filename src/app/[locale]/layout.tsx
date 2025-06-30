import { getMessages } from "next-intl/server";
import { ClientProviders } from "@/providers/ClientProviders";
import { LanguageSwitcherCompact } from "@/components/LanguageSwitcher";

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <ClientProviders messages={messages} locale={locale}>
      <div className="min-h-screen flex flex-col">
        {/* Language switcher in top-right corner */}
        <div className="absolute top-4 right-4 z-50">
          <LanguageSwitcherCompact />
        </div>

        {/* Main content */}
        <main className="flex-1">{children}</main>
      </div>
    </ClientProviders>
  );
}
