"use client";

import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  icon: string;
  iconColor?: string;
  title: string;
  description: string;
  className?: string;
}

export function FeatureCard({
  icon,
  iconColor = "text-primary",
  title,
  description,
  className,
}: FeatureCardProps) {
  return (
    <div
      className={cn(
        "group relative p-6 rounded-2xl",
        "bg-card border border-border",
        "hover:border-primary/30 hover:shadow-lg transition-all duration-300",
        className
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "w-12 h-12 rounded-xl mb-4",
          "bg-primary/10 border border-primary/20",
          "flex items-center justify-center",
          "group-hover:bg-primary/15 transition-colors",
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
