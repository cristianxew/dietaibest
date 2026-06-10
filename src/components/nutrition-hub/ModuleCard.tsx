import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ModuleAccent = "brand" | "sage" | "gold" | "stone";

const ACCENT_STYLES: Record<
  ModuleAccent,
  { tile: string; icon: string; hover: string; kicker: string }
> = {
  brand: {
    tile: "from-brand-100 to-brand-50 dark:from-brand-500/20 dark:to-brand-500/10 border-brand-200/50 dark:border-brand-500/20",
    icon: "text-brand-600 dark:text-brand-400",
    hover:
      "hover:border-brand-300/70 dark:hover:border-brand-500/40 hover:shadow-brand-500/5",
    kicker: "text-brand-600 dark:text-brand-400",
  },
  sage: {
    tile: "from-sage-100 to-sage-50 dark:from-sage-500/20 dark:to-sage-500/10 border-sage-200/50 dark:border-sage-500/20",
    icon: "text-sage-600 dark:text-sage-400",
    hover:
      "hover:border-sage-300/70 dark:hover:border-sage-500/40 hover:shadow-sage-500/5",
    kicker: "text-sage-600 dark:text-sage-400",
  },
  gold: {
    tile: "from-gold-100 to-gold-50 dark:from-gold-500/20 dark:to-gold-500/10 border-gold-200/50 dark:border-gold-500/20",
    icon: "text-gold-600 dark:text-gold-400",
    hover:
      "hover:border-gold-300/70 dark:hover:border-gold-500/40 hover:shadow-gold-500/5",
    kicker: "text-gold-600 dark:text-gold-400",
  },
  stone: {
    tile: "from-stone-100 to-stone-50 dark:from-stone-500/20 dark:to-stone-500/10 border-stone-200/50 dark:border-stone-500/20",
    icon: "text-stone-600 dark:text-stone-400",
    hover:
      "hover:border-stone-300/70 dark:hover:border-stone-500/40 hover:shadow-stone-500/5",
    kicker: "text-stone-500 dark:text-stone-400",
  },
};

interface ModuleCardProps {
  href: string;
  icon: LucideIcon;
  accent: ModuleAccent;
  kicker: string;
  title: string;
  blurb: string;
  className?: string;
  style?: React.CSSProperties;
}

export function ModuleCard({
  href,
  icon: Icon,
  accent,
  kicker,
  title,
  blurb,
  className,
  style,
}: ModuleCardProps) {
  const styles = ACCENT_STYLES[accent];

  return (
    <Link
      href={href}
      style={style}
      className={cn(
        "group relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-6",
        "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg",
        styles.hover,
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "p-2.5 rounded-xl bg-gradient-to-br border",
            styles.tile
          )}
        >
          <Icon className={cn("w-5 h-5", styles.icon)} />
        </div>
        <ArrowRight className="w-4 h-4 mt-1 text-muted-foreground/50 transition-all duration-300 group-hover:translate-x-1 group-hover:text-foreground" />
      </div>
      <div className="space-y-1.5">
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-widest",
            styles.kicker
          )}
        >
          {kicker}
        </span>
        <h3 className="font-display text-xl font-bold text-foreground tracking-tight">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{blurb}</p>
      </div>
    </Link>
  );
}
