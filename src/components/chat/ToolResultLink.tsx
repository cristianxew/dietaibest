"use client";

import React from "react";
import Link from "next/link";
import { FileText, Calendar, ShoppingBag, ArrowRight } from "lucide-react";

export type LinkType = "recipe" | "mealplan" | "shoppinglist";

interface ToolResultLinkProps {
  type: LinkType;
  label: string;
  href: string;
}

const CONFIG: Record<LinkType, { Icon: typeof FileText; color: string }> = {
  recipe: { Icon: FileText, color: "var(--primary)" },
  mealplan: { Icon: Calendar, color: "var(--gold-500)" },
  shoppinglist: { Icon: ShoppingBag, color: "var(--success)" },
};

export function ToolResultLink({ type, label, href }: ToolResultLinkProps) {
  const { Icon, color } = CONFIG[type] ?? CONFIG.recipe;

  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 rounded-lg border-[1.5px] border-border bg-card px-4 py-2 text-sm font-semibold text-foreground no-underline transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:shadow-sm"
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "";
      }}
    >
      <Icon size={16} style={{ color }} className="shrink-0" />
      <span className="truncate">{label}</span>
      <ArrowRight size={14} className="shrink-0 text-muted-foreground" />
    </Link>
  );
}
