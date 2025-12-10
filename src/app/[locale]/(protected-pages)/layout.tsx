import { getMessages } from "next-intl/server";
import { ClientProviders } from "@/providers/ClientProviders";
import { AppSidebar } from "@/components/navigation/AppSidebar";

interface ProtectedLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * Layout for protected pages (dashboard, recipes, meal-plans, etc.)
 * Uses sidebar navigation instead of top header
 */
export default async function ProtectedLayout({
  children,
  params,
}: ProtectedLayoutProps) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <ClientProviders messages={messages} locale={locale} timeZone="UTC">
      <div className="flex min-h-screen bg-background">
        {/* Sidebar Navigation */}
        <AppSidebar />

        {/* Main Content */}
        <main
          id="main-content"
          className="flex-1 overflow-auto"
          tabIndex={-1}
          aria-label="Main content"
        >
          <div className="container mx-auto p-6 md:p-8 pt-16 md:pt-8">
            {children}
          </div>
        </main>
      </div>
    </ClientProviders>
  );
}
