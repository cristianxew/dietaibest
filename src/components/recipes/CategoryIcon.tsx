"use client";

import {
  Sunrise,
  Sun,
  Moon,
  Cookie,
  Cake,
  Coffee,
  Leaf,
  Carrot,
  WheatOff,
  Scale,
  UtensilsCrossed,
} from "lucide-react";

interface CategoryIconProps {
  iconName?: string;
  className?: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  sunrise: Sunrise,
  sun: Sun,
  moon: Moon,
  cookie: Cookie,
  cake: Cake,
  coffee: Coffee,
  leaf: Leaf,
  carrot: Carrot,
  "wheat-off": WheatOff,
  scale: Scale,
};

export function CategoryIcon({
  iconName,
  className = "h-4 w-4",
}: CategoryIconProps) {
  const IconComponent = iconMap[iconName || ""] || UtensilsCrossed;

  return <IconComponent className={className} />;
}
