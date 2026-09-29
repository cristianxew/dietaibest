import { cn } from "@/lib/utils";

export interface Stat {
  /** Display value, already formatted for the locale (e.g. "22"). */
  value: string;
  label: string;
}

interface StatsStripProps {
  /** Designed for exactly four stats (4 columns wide, 2×2 below 701px). */
  stats: Stat[];
}

/**
 * Row of headline numbers. Not rendered on the landing yet: enable it only
 * with real, verifiable figures (see src/app/[locale]/(public-pages)/page.tsx).
 */
export function StatsStrip({ stats }: StatsStripProps) {
  if (stats.length === 0) return null;

  return (
    <section className="py-16">
      <div className="mx-auto max-w-[1180px] px-8">
        <div className="grid grid-cols-4 border-y border-lp-line py-12 max-[701px]:grid-cols-2 max-[701px]:gap-y-8 max-[701px]:py-8">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={cn(
                "border-lp-line px-6 max-[701px]:p-4",
                // Wide: vertical dividers between all four stats.
                i < stats.length - 1 && "border-r",
                // ≤700px (2×2): only the left column keeps a divider, only the top row a bottom rule.
                i % 2 === 1 && "max-[701px]:border-r-0",
                i < 2 && "max-[701px]:border-b"
              )}
            >
              <div className="mb-2 font-lp-display text-[44px] font-medium leading-none tracking-[-0.02em]">
                {stat.value}
              </div>
              <div className="font-lp-mono text-[11px] uppercase tracking-[0.12em] text-lp-muted">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
