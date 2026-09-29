"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Columns2, Layers, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { FilterChip, FilterSection } from "@/components/custom-ui/filter-chip";
import { cn } from "@/lib/utils";

type Layout = "grid" | "stack" | "split";
type Density = "regular" | "compact";

interface ViewOptionsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The layout actually rendered (Grid already falls back to Stack on phones). */
  layout: Layout;
  onLayoutChange: (layout: Layout) => void;
  density: Density;
  onDensityChange: (density: Density) => void;
  showServings: boolean;
  onShowServingsChange: (show: boolean) => void;
  className?: string;
}

/**
 * Phone-only trigger + bottom drawer for the planner's layout, density and
 * servings controls, so the sticky toolbar stays a single row (mirrors the
 * recipes Filters drawer). Grid is not offered: it needs tablet width.
 * Options apply live; "Done" just closes the drawer.
 */
export function ViewOptionsDrawer({
  open,
  onOpenChange,
  layout,
  onLayoutChange,
  density,
  onDensityChange,
  showServings,
  onShowServingsChange,
  className,
}: ViewOptionsDrawerProps) {
  const t = useTranslations("mealPlans");
  const servingsSwitchId = useId();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <button
          type="button"
          aria-label={t("viewOptions.title")}
          className={cn(
            "inline-flex items-center justify-center h-11 min-w-11 shrink-0 px-3 rounded-xl border text-[13px] font-medium shadow-sm transition-colors",
            "border-border/60 bg-background text-foreground/80 hover:border-brand-300",
            className
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </DrawerTrigger>

      <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[85dvh] data-[vaul-drawer-direction=bottom]:rounded-t-2xl">
        <div className="mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle className="font-display text-lg">
              {t("viewOptions.title")}
            </DrawerTitle>
            <DrawerDescription>{t("viewOptions.description")}</DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-6">
            <FilterSection title={t("viewOptions.layout")}>
              <FilterChip
                active={layout === "stack"}
                onClick={() => onLayoutChange("stack")}
              >
                <Layers className="h-3.5 w-3.5" />
                {t("layout.stack")}
              </FilterChip>
              <FilterChip
                active={layout === "split"}
                onClick={() => onLayoutChange("split")}
              >
                <Columns2 className="h-3.5 w-3.5" />
                {t("layout.split")}
              </FilterChip>
            </FilterSection>

            <FilterSection title={t("viewOptions.density")}>
              {(["regular", "compact"] as const).map((d) => (
                <FilterChip
                  key={d}
                  active={density === d}
                  onClick={() => onDensityChange(d)}
                >
                  {t(`density.${d}`)}
                </FilterChip>
              ))}
            </FilterSection>

            <label
              htmlFor={servingsSwitchId}
              className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-border/70 bg-card px-3.5 py-2 cursor-pointer"
            >
              <span className="text-sm font-medium text-foreground">
                {t("showServings")}
              </span>
              <Switch
                id={servingsSwitchId}
                checked={showServings}
                onCheckedChange={onShowServingsChange}
              />
            </label>
          </div>

          <DrawerFooter className="border-t border-border/60 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DrawerClose asChild>
              <Button className="h-11 w-full bg-brand-500 hover:bg-brand-600 text-white">
                {t("viewOptions.done")}
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
