'use client';

import * as Lucide from "lucide-react";

export function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const Cmp = (Lucide as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[name]
    ?? Lucide.HelpCircle;
  return <Cmp size={size} className={className} />;
}
