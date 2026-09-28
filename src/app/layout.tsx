import type { Metadata, Viewport } from "next";
import { DM_Sans, Playfair_Display, Inter, Lato, Alice, Poppins } from "next/font/google";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { unstable_rethrow } from "next/navigation";
import { getLocale } from "next-intl/server";
import "./globals.css";

// Primary fonts for the "Culinary Elegance" design system
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-playfair",
});

// Keep Inter as fallback
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2c3e50" },
    { media: "(prefers-color-scheme: dark)", color: "#1a252f" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "DietAI — Healthy eating, simplified.",
  description:
    "Save recipes from any website, video or photo, see USDA-based nutrition and plan your week.",
  keywords: [
    "meal planning",
    "nutrition",
    "AI",
    "diet",
    "recipes",
    "macros",
    "health",
    "automation",
  ],
  authors: [{ name: "DietAI" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DietAI",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "DietAI — Healthy eating, simplified.",
    description:
      "Save recipes from any website, video or photo, see USDA-based nutrition and plan your week.",
    type: "website",
    siteName: "DietAI",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

/** Active next-intl locale for `<html lang>`; "en" when none can be resolved. */
async function resolveHtmlLang(): Promise<string> {
  try {
    return await getLocale();
  } catch (error) {
    unstable_rethrow(error); // let Next's dynamic-rendering signals through
    return "en";
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await resolveHtmlLang();

  return (
    <html
      lang={lang}
      suppressHydrationWarning
      className={`
        ${dmSans.variable}
        ${playfair.variable}
        ${inter.variable}
      `}
    >
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
