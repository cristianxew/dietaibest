"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Calendar, ShoppingBag, ArrowRight } from "lucide-react";
import { withReturnPath } from "@/lib/recipe-back-link";

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
  const router = useRouter();

  // Recipe links remember the page the chat is open on, so the recipe page's
  // "Back" returns there. Read at click time (the page can change while the
  // chat stays open); modified clicks keep the plain href.
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (type !== "recipe" || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    router.push(withReturnPath(href, window.location.pathname + window.location.search));
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      className="group inline-flex max-w-full min-w-0 items-center gap-2 rounded-lg border-[1.5px] border-border bg-card px-4 py-2 text-sm font-semibold text-foreground no-underline transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:shadow-sm"
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
