interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * Base layout for locale-specific routes
 *
 * Navigation is handled by route group layouts:
 * - (public-pages): Uses LandingNav (top navigation)
 * - (protected-pages): Uses AppSidebar (sidebar navigation)
 *
 * Both route groups have their own layouts that include ClientProviders
 * This layout only provides the locale wrapper structure
 */
export default async function LocaleLayout({
  children,
}: LocaleLayoutProps) {
  return <>{children}</>;
}
