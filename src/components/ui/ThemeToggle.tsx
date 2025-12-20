"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ThemeToggleProps {
  variant?: "default" | "outline" | "ghost" | "minimal";
  size?: "sm" | "md" | "lg";
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({
  variant = "ghost",
  size = "md",
  className,
  showLabel = false,
}: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700",
          size === "sm" && "h-8 w-8",
          size === "md" && "h-9 w-9",
          size === "lg" && "h-10 w-10",
          showLabel && "w-24",
          className
        )}
      />
    );
  }

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-9 w-9",
    lg: "h-10 w-10",
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant === "minimal" ? "ghost" : variant}
          size="icon"
          className={cn(
            sizeClasses[size],
            variant === "minimal" &&
              "hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full",
            className
          )}
          aria-label="Toggle theme"
        >
          <Sun
            className={cn(
              iconSizes[size],
              "rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
            )}
          />
          <Moon
            className={cn(
              iconSizes[size],
              "absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
            )}
          />
          {showLabel && (
            <span className="ml-2 capitalize">{resolvedTheme}</span>
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[120px]">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={cn(
            "flex items-center gap-2 cursor-pointer",
            theme === "light" && "bg-neutral-100 dark:bg-neutral-800"
          )}
        >
          <Sun className="h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={cn(
            "flex items-center gap-2 cursor-pointer",
            theme === "dark" && "bg-neutral-100 dark:bg-neutral-800"
          )}
        >
          <Moon className="h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={cn(
            "flex items-center gap-2 cursor-pointer",
            theme === "system" && "bg-neutral-100 dark:bg-neutral-800"
          )}
        >
          <Monitor className="h-4 w-4" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Simple theme toggle button without dropdown (just cycles through themes)
 */
export function ThemeToggleSimple({
  size = "md",
  className,
}: Omit<ThemeToggleProps, "showLabel" | "variant">) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700",
          size === "sm" && "h-8 w-8",
          size === "md" && "h-9 w-9",
          size === "lg" && "h-10 w-10",
          className
        )}
      />
    );
  }

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  return (
    <button
      onClick={cycleTheme}
      className={cn(
        "relative flex items-center justify-center rounded-full transition-colors",
        "hover:bg-neutral-100 dark:hover:bg-neutral-800",
        "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
        size === "sm" && "h-8 w-8",
        size === "md" && "h-9 w-9",
        size === "lg" && "h-10 w-10",
        className
      )}
      aria-label={`Current theme: ${resolvedTheme}. Click to cycle themes.`}
    >
      {resolvedTheme === "dark" ? (
        <Moon className={cn(iconSizes[size], "text-neutral-400")} />
      ) : resolvedTheme === "light" ? (
        <Sun className={cn(iconSizes[size], "text-neutral-600")} />
      ) : (
        <Monitor className={cn(iconSizes[size], "text-neutral-500")} />
      )}
    </button>
  );
}
