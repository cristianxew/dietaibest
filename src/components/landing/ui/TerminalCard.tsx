"use client";

import { cn } from "@/lib/utils";

interface TerminalLineProps {
  prefix?: string;
  label?: string;
  value: string;
  valueColor?: string;
}

interface TerminalCardProps {
  title?: string;
  lines?: TerminalLineProps[];
  children?: React.ReactNode;
  className?: string;
}

export function TerminalCard({
  title = "terminal",
  lines = [],
  children,
  className,
}: TerminalCardProps) {
  return (
    <div
      className={cn(
        "terminal relative rounded-2xl p-8 shadow-2xl overflow-hidden",
        className
      )}
    >
      {/* Glow effect */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

      <div className="relative z-10">
        {/* Window controls */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <div className="ml-auto text-xs font-mono text-muted-foreground">
            {title}
          </div>
        </div>

        {/* Terminal content */}
        <div className="space-y-6 font-mono text-sm">
          {lines.map((line, index) => (
            <div key={index}>
              <span className="text-primary">{line.prefix || "➜"}</span>{" "}
              {line.label && (
                <span className="text-muted-foreground">{line.label}:</span>
              )}{" "}
              <span className={cn("text-foreground", line.valueColor)}>
                {line.value}
              </span>
            </div>
          ))}
          {children}
        </div>
      </div>
    </div>
  );
}

interface TerminalSectionProps {
  children: React.ReactNode;
  className?: string;
}

export function TerminalSection({ children, className }: TerminalSectionProps) {
  return (
    <div
      className={cn(
        "py-4 border-y border-border/30 my-4 space-y-1",
        className
      )}
    >
      {children}
    </div>
  );
}

interface TerminalRowProps {
  label: string;
  value: string;
  valueColor?: string;
}

export function TerminalRow({
  label,
  value,
  valueColor = "text-primary",
}: TerminalRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-foreground">{label}</span>
      <span className={valueColor}>{value}</span>
    </div>
  );
}
