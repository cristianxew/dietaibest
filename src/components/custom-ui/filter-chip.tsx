import { cn } from "@/lib/utils";

/**
 * Pill toggle for bottom-drawer option sheets (recipe filters, meal plan view
 * options). 36px tall; the vertical hit slop keeps the touch target at 44px
 * (chips wrap with an 8px gap, so the slop never overlaps a neighbour).
 */
export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-[13px] font-medium transition-colors",
        "after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
        active
          ? "bg-brand-500 border-brand-500 text-white shadow-sm"
          : "bg-card border-border/70 text-foreground/80 hover:border-brand-300 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

/** Labelled group of `FilterChip`s inside a drawer. */
export function FilterSection({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <h3 className="mb-2.5 font-sans text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}
