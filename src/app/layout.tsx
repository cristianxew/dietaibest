import type { Metadata } from "next";
import { Lato, Alice, Poppins } from "next/font/google";
import "./globals.css";

// Lato for general body text
const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-lato",
});

// Alice for headings and section titles
const alice = Alice({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-alice",
});

// Poppins for header nav items and buttons
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "DietAIbook - AI-Powered Meal Planning",
  description:
    "Personalized meal planning and nutrition tracking with AI assistance",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body
        className={`${lato.variable} ${alice.variable} ${poppins.variable} ${lato.className}`}
      >
        {children}
      </body>
    </html>
  );
}
