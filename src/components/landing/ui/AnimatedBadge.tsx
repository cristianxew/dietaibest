"use client";

import { cn } from "@/lib/utils";

interface AnimatedBadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "success" | "warning" | "info";
  pulse?: boolean;
}

export function AnimatedBadge({
  children,
  className,
  variant = "success",
  pulse = true,
}: AnimatedBadgeProps) {
  const variantStyles = {
    default: {
      dot: "bg-muted-foreground",
      ping: "bg-muted-foreground",
    },
    success: {
      dot: "bg-primary",
      ping: "bg-primary",
    },
    warning: {
      dot: "bg-amber-500",
      ping: "bg-amber-500",
    },
    info: {
      dot: "bg-sky-500",
      ping: "bg-sky-500",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 self-start",
        "bg-card border border-border",
        "rounded-full px-3.5 py-1.5 shadow-sm",
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
      <span className="text-xs font-medium text-muted-foreground">
        {children}
      </span>
    </div>
  );
}
