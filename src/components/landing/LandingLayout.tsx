"use client";

import { cn } from "@/lib/utils";

interface LandingLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Main container for the landing page
 * "Culinary Elegance" design system - warm, appetizing, sophisticated
 */
export function LandingLayout({ children, className }: LandingLayoutProps) {
  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Warm gradient background - Culinary Elegance */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Top-right coral/peach glow */}
        <div
          className="absolute -top-40 -right-40 w-[700px] h-[700px] rounded-full opacity-40 dark:opacity-20"
          style={{
            background: "radial-gradient(circle, #FDE4DC 0%, #FBC6B8 40%, transparent 70%)",
          }}
        />
        {/* Bottom-left golden amber glow */}
        <div
          className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full opacity-30 dark:opacity-15"
          style={{
            background: "radial-gradient(circle, #FEF3C7 0%, #FDE68A 40%, transparent 70%)",
          }}
        />
        {/* Center subtle warm wash */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[800px] rounded-full opacity-10 dark:opacity-5"
          style={{
            background: "radial-gradient(ellipse, #FEF3F0 0%, transparent 60%)",
          }}
        />
      </div>

      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02] dark:opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Main Content */}
      <main className={cn("relative z-10 flex flex-col min-h-screen", className)}>
        {children}
      </main>
    </div>
  );
}
