import Link from "next/link";
import { cn } from "@/lib/utils";

interface LandingButtonProps {
  /** Route (rendered with `next/link`) or in-page `#anchor` (plain `<a>`). */
  href: string;
  variant?: "primary" | "ghost";
  /** Inverted colors for use on the dark ink panels (final CTA). */
  onInk?: boolean;
  className?: string;
  children: React.ReactNode;
}

const base =
  "inline-block whitespace-nowrap rounded-full px-[18px] py-[10px] text-[14px] font-medium duration-150 ease-[ease]";

const variants = {
  primary: {
    default: "bg-lp-fg text-lp-bg hover:bg-lp-fg-strong",
    onInk: "bg-lp-ink-fg text-lp-ink hover:bg-white",
    shared: "transition-[translate,background-color] hover:-translate-y-px",
  },
  ghost: {
    default: "border-lp-line text-lp-fg hover:border-lp-fg hover:bg-lp-fg/2",
    onInk: "border-lp-ink-fg/25 text-lp-ink-fg hover:border-lp-ink-fg hover:bg-white/5",
    shared: "border bg-transparent transition-[border-color,background-color]",
  },
} as const;

export function LandingButton({
  href,
  variant = "primary",
  onInk = false,
  className,
  children,
}: LandingButtonProps) {
  const styles = variants[variant];
  const classes = cn(base, styles.shared, onInk ? styles.onInk : styles.default, className);

  if (href.startsWith("#")) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
