import { getMessages } from "next-intl/server";
import { ClientProviders } from "@/providers/ClientProviders";
import { AppSidebarDock } from "@/components/navigation/AppSidebarDock";
import { RecipeModalProvider } from "@/providers/RecipeModalProvider";
import { ChatContainer } from "@/components/chat/ChatContainer";

interface ProtectedLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * Layout for protected pages (dashboard, recipes, meal-plans, etc.)
 * Uses the dock-style sidebar with integrated controls
 */
export default async function ProtectedLayout({
  children,
  params,
}: ProtectedLayoutProps) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <ClientProviders messages={messages} locale={locale} timeZone="UTC">
      <RecipeModalProvider>
        {/* AppSidebarDock includes navigation, theme, language, and user controls */}
        <AppSidebarDock>
          <ChatContainer>
            {children}
          </ChatContainer>
        </AppSidebarDock>
      </RecipeModalProvider>
    </ClientProviders>
  );
}
