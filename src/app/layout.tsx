import type { Metadata, Viewport } from "next";
import { DM_Sans, Playfair_Display, Inter, Lato, Alice, Poppins } from "next/font/google";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
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
  title: "DietAI - Autonomous Nutrition Operating System",
  description:
    "Stop manually tracking calories. DietAI agents build your meal plans, scrape recipes, and order your groceries automatically—while balancing your macros.",
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
    title: "DietAI - Nutrition on Autopilot",
    description:
      "AI-powered meal planning and nutrition tracking. Let our agents handle the tedious parts of nutrition.",
    type: "website",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
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
