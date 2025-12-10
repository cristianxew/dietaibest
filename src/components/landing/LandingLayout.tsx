"use client";

import { cn } from "@/lib/utils";

interface LandingLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Main container for the landing page
 * Uses the unified design system with subtle depth and organic warmth
 */
export function LandingLayout({ children, className }: LandingLayoutProps) {
  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Top-right brand glow */}
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-30 dark:opacity-15"
          style={{
            background: "radial-gradient(circle, var(--brand-200) 0%, transparent 70%)",
          }}
        />
        {/* Bottom-left warm glow */}
        <div
          className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-20 dark:opacity-10"
          style={{
            background: "radial-gradient(circle, #FED7AA 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.015] dark:opacity-[0.03]"
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
