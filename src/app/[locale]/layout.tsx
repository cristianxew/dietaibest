import { getMessages } from "next-intl/server";
import { ClientProviders } from "@/providers/ClientProviders";
import Header from "@/components/navigation/Header";

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
        {/* Header Navigation */}
        <Header />

        {/* Main content with proper spacing to account for sticky header */}
        <main
          id="main-content"
          className="flex-1 relative"
          tabIndex={-1}
          aria-label="Main content"
        >
          {children}
        </main>
      </div>
    </ClientProviders>
  );
}
