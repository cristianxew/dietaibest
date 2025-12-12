"use client";

import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  icon: string;
  iconColor?: string;
  iconBg?: string;
  title: string;
  description: string;
  className?: string;
}

export function FeatureCard({
  icon,
  iconColor = "text-brand-600 dark:text-brand-400",
  iconBg = "bg-brand-50 border-brand-100 dark:bg-brand-500/10 dark:border-brand-500/20",
  title,
  description,
  className,
}: FeatureCardProps) {
  return (
    <div
      className={cn(
        "group relative p-6 rounded-2xl",
        "bg-card border border-border",
        "hover:border-brand-200 dark:hover:border-brand-500/30 hover:shadow-lg hover:shadow-brand-500/5 transition-all duration-300",
        className
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "w-12 h-12 rounded-xl mb-4",
          "border flex items-center justify-center",
          "group-hover:scale-105 transition-transform duration-300",
          iconBg,
          iconColor
        )}
      >
        <Icon icon={icon} width={24} />
      </div>

      {/* Content */}
      <h3 className="text-lg font-display font-semibold text-foreground mb-2">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}
