import { getMessages } from "next-intl/server";
import { ClientProviders } from "@/providers/ClientProviders";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { TopHeaderBar } from "@/components/navigation/TopHeaderBar";
import { MobileSidebarTrigger } from "@/components/navigation/MobileSidebarTrigger";

interface ProtectedLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * Layout for protected pages (dashboard, recipes, meal-plans, etc.)
 * Uses sidebar navigation with shadcn sidebar primitives
 * TopHeaderBar provides theme, language, and user controls
 */
export default async function ProtectedLayout({
  children,
  params,
}: ProtectedLayoutProps) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <ClientProviders messages={messages} locale={locale} timeZone="UTC">
      {/* AppSidebar includes SidebarProvider, Sidebar, and SidebarInset */}
      <AppSidebar>
        {/* Mobile trigger for sidebar */}
        <MobileSidebarTrigger />
        {/* Floating header bar with theme, language, user controls */}
        <TopHeaderBar />
        <main
          id="main-content"
          className="flex-1 overflow-auto"
          tabIndex={-1}
          aria-label="Main content"
        >
          {children}
        </main>
      </AppSidebar>
    </ClientProviders>
  );
}
