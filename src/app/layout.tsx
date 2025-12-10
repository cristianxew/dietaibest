import type { Metadata } from "next";
import { Inter, Space_Grotesk, Lato, Alice, Poppins } from "next/font/google";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import "./globals.css";

// Primary fonts for the new design system
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
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
  openGraph: {
    title: "DietAI - Nutrition on Autopilot",
    description:
      "AI-powered meal planning and nutrition tracking. Let our agents handle the tedious parts of nutrition.",
    type: "website",
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
          ${inter.variable}
          ${spaceGrotesk.variable}
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
