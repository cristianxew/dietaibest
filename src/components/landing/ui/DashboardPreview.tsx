"use client";

import { Icon } from "@iconify/react";
import { Link, Scale, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

interface MacroCircleProps {
  percentage: number;
  label: string;
  color: string;
}

function MacroCircle({ percentage, label, color }: MacroCircleProps) {
  return (
    <div className="text-center">
      <div
        className={cn(
          "w-10 h-10 rounded-full border-2 flex items-center justify-center text-[0.65rem] font-bold text-foreground",
          color
        )}
      >
        {percentage}%
      </div>
      <div className="text-[0.6rem] text-muted-foreground mt-1 uppercase">
        {label}
      </div>
    </div>
  );
}

interface ActivityItemProps {
  icon: React.ReactNode;
  label: string;
  status: "done" | "loading";
}

function ActivityItem({ icon, label, status }: ActivityItemProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between text-xs",
        status === "loading" && "opacity-50"
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      {status === "done" ? (
        <span className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[0.6rem] font-medium">
          Done
        </span>
      ) : (
        <span className="animate-pulse bg-muted px-1.5 py-0.5 rounded text-[0.6rem] w-8 h-4 block" />
      )}
    </div>
  );
}

interface DashboardPreviewProps {
  className?: string;
}

export function DashboardPreview({ className }: DashboardPreviewProps) {
  return (
    <div className={cn("relative group", className)}>
      {/* Decorative gradient background */}
      <div className="absolute -inset-4 bg-gradient-to-tr from-primary/10 to-muted rounded-[2rem] -z-10 blur-xl opacity-60 group-hover:opacity-80 transition-opacity duration-700" />

      {/* Main Card */}
      <div className="bg-card rounded-2xl shadow-2xl border border-border overflow-hidden relative">
        {/* Header Mockup */}
        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/50">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400/80" />
            <div className="w-3 h-3 rounded-full bg-amber-400/80" />
            <div className="w-3 h-3 rounded-full bg-green-400/80" />
          </div>
          <div className="text-[0.65rem] font-mono text-muted-foreground uppercase tracking-widest">
            Weekly_Plan.ai
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="p-6 space-y-6">
          {/* Macros Row */}
          <div className="flex justify-between items-end">
            <div>
              <div className="text-xs text-muted-foreground font-medium mb-1">
                Daily Target
              </div>
              <div className="text-3xl font-display font-semibold text-foreground">
                2,450{" "}
                <span className="text-sm text-muted-foreground font-normal">
                  kcal
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <MacroCircle
                percentage={45}
                label="Carb"
                color="border-primary"
              />
              <MacroCircle
                percentage={30}
                label="Prot"
                color="border-blue-500"
              />
              <MacroCircle
                percentage={25}
                label="Fat"
                color="border-orange-400"
              />
            </div>
          </div>

          {/* Agent Activity */}
          <div className="bg-muted/50 rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Icon
                icon="solar:stars-minimalistic-bold-duotone"
                className="text-purple-500"
              />
              <span className="text-xs font-semibold text-foreground">
                Agent Activity
              </span>
            </div>
            <div className="space-y-3">
              <ActivityItem
                icon={<Link className="w-3 h-3" />}
                label='Scraped "Spicy Tofu Bowl"'
                status="done"
              />
              <ActivityItem
                icon={<Scale className="w-3 h-3" />}
                label="Adjusting Macros"
                status="done"
              />
              <ActivityItem
                icon={<ShoppingCart className="w-3 h-3" />}
                label="Instacart Checkout"
                status="loading"
              />
            </div>
          </div>

          {/* Toggle Button */}
          <div className="flex items-center justify-between bg-foreground text-background p-4 rounded-xl shadow-lg">
            <div className="flex items-center gap-3">
              <div className="bg-background/20 p-2 rounded-lg">
                <Icon icon="solar:cart-check-bold-duotone" width={18} />
              </div>
              <div className="text-xs">
                <div className="font-medium">Auto-Purchase</div>
                <div className="text-background/60">Whole Foods Market</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-9 h-5 bg-background/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
