"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/**
 * Mobile sidebar trigger button
 * Fixed position button that appears on mobile to toggle the sidebar
 */
export function MobileSidebarTrigger() {
  return (
    <SidebarTrigger
      className={cn(
        "fixed top-4 left-4 z-50 md:hidden",
        "size-9 rounded-lg",
        "bg-background/95 backdrop-blur-sm",
        "border border-border shadow-md",
        "hover:bg-accent"
      )}
    />
  );
}
