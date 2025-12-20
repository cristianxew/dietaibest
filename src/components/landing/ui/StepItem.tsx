"use client";

import { cn } from "@/lib/utils";

interface StepItemProps {
  number: number;
  title: string;
  description: string;
  className?: string;
}

export function StepItem({
  number,
  title,
  description,
  className,
}: StepItemProps) {
  return (
    <div className={cn("flex gap-6 group", className)}>
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full",
          "border border-border",
          "bg-card",
          "text-muted-foreground",
          "flex items-center justify-center text-sm font-medium",
          "group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary",
          "transition-colors"
        )}
      >
        {number}
      </div>
      <div>
        <h4 className="text-lg font-semibold text-foreground mb-2">
          {title}
        </h4>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

interface StepConnectorProps {
  className?: string;
}

export function StepConnector({ className }: StepConnectorProps) {
  return (
    <div
      className={cn(
        "w-px h-8 bg-border ml-4",
        className
      )}
    />
  );
}
