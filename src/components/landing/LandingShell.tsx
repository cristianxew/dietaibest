import { cn } from "@/lib/utils";
import { landingDisplay, landingMono } from "./fonts";

interface LandingShellProps {
  children: React.ReactNode;
}

/**
 * Root wrapper for the marketing landing. The `landing` class scopes the
 * `--lp-*` design tokens (light/dark) defined in globals.css.
 * `overflow-x-clip` (not `hidden`) contains the hero glow/orbs without
 * creating a scroll container, which would break the sticky nav.
 * Responsive variants use `max-[N+1px]` to mirror the design's `max-width: Npx`
 * (Tailwind compiles `max-[Npx]` to `width < N`).
 */
export function LandingShell({ children }: LandingShellProps) {
  return (
    <div
      className={cn(
        "landing min-h-screen overflow-x-clip bg-lp-bg font-sans text-lp-fg antialiased [text-rendering:optimizeLegibility]",
        landingDisplay.variable,
        landingMono.variable
      )}
    >
      {children}
    </div>
  );
}
