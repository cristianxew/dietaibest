"use client";

import { cn } from "@/lib/utils";

interface AnimatedBadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "success" | "warning" | "info" | "gold" | "brand";
  pulse?: boolean;
}

export function AnimatedBadge({
  children,
  className,
  variant = "brand",
  pulse = true,
}: AnimatedBadgeProps) {
  const variantStyles = {
    default: {
      dot: "bg-muted-foreground",
      ping: "bg-muted-foreground",
      container: "bg-card border-border",
    },
    success: {
      dot: "bg-sage-500",
      ping: "bg-sage-500",
      container: "bg-sage-50 border-sage-200 dark:bg-sage-500/10 dark:border-sage-500/30",
    },
    warning: {
      dot: "bg-amber-500",
      ping: "bg-amber-500",
      container: "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30",
    },
    info: {
      dot: "bg-sky-500",
      ping: "bg-sky-500",
      container: "bg-sky-50 border-sky-200 dark:bg-sky-500/10 dark:border-sky-500/30",
    },
    gold: {
      dot: "bg-gold-500",
      ping: "bg-gold-400",
      container: "bg-gold-50 border-gold-200 dark:bg-gold-500/10 dark:border-gold-500/30",
    },
    brand: {
      dot: "bg-brand-500",
      ping: "bg-brand-400",
      container: "bg-brand-50 border-brand-200 dark:bg-brand-500/10 dark:border-brand-500/30",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 self-start",
        "border rounded-full px-3.5 py-1.5 shadow-sm",
        styles.container,
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        {pulse && (
          <span
            className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-60",
              styles.ping
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex rounded-full h-2 w-2",
            styles.dot
          )}
        />
      </span>
      <span className="text-xs font-medium text-foreground/80">
        {children}
      </span>
    </div>
  );
}
