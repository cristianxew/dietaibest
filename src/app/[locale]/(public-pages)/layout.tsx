import { getMessages } from "next-intl/server";
import { ClientProviders } from "@/providers/ClientProviders";

interface PublicPagesLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * Layout for public pages (landing, marketing, etc.)
 * Does NOT include the app Header - uses landing-specific navigation instead
 */
export default async function PublicPagesLayout({
  children,
  params,
}: PublicPagesLayoutProps) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <ClientProviders messages={messages} locale={locale} timeZone="UTC">
      {children}
    </ClientProviders>
  );
}
