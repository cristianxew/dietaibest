import type { Metadata } from "next";
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

// Geist Mono for code and technical content
const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  fallback: ["ui-monospace", "monospace"],
});

// Legacy fonts (kept for backward compatibility with existing app pages)
const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-lato",
});

const alice = Alice({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-alice",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#22c55e" },
    { media: "(prefers-color-scheme: dark)", color: "#16a34a" },
  ],
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
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`
          ${dmSans.variable}
          ${playfair.variable}
          ${inter.variable}
          ${geistMono.variable}
          ${lato.variable}
          ${alice.variable}
          ${poppins.variable}
          antialiased
        `}
      >
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
