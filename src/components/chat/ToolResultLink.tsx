"use client";

import React from "react";
import Link from "next/link";
import { FileText, CalendarDays, ShoppingCart, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type LinkType = "recipe" | "mealplan" | "shoppinglist";

interface ToolResultLinkProps {
  type: LinkType;
  label: string;
  href: string;
}

export function ToolResultLink({ type, label, href }: ToolResultLinkProps) {
  const Icon = 
    type === "recipe" ? FileText :
    type === "mealplan" ? CalendarDays :
    ShoppingCart;

  return (
    <Link 
      href={href}
      className={cn(
        "flex items-center gap-3 p-3 mt-2 rounded-xl border max-w-[280px]",
        "bg-card border-border",
        "hover:border-brand-300 dark:hover:border-brand-500/50 hover:bg-brand-50/50 dark:hover:bg-brand-500/5",
        "transition-all duration-200 group"
      )}
    >
      <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
        <Icon size={16} />
      </div>
      <span className="text-sm font-medium text-foreground truncate flex-1">
        {label}
      </span>
      <ChevronRight size={16} className="text-muted-foreground group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
    </Link>
  );
}
