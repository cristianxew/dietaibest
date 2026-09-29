"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { GripVertical, Clock, CalendarDays, ChevronLeft, ChevronRight, Info, Utensils, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsTouchFirst, useViewportTier } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { scheduleMealPlan, unscheduleMealPlan } from "@/actions/meal-plan";
import type { TemplateWithMealsAndSchedules } from "@/lib/meal-plan-adapter";
import { addDays, canScheduleOn, overlapsSchedule, startOfDay } from "@/lib/meal-plan-schedule";
import { useTranslations } from "next-intl";

// ── Per-plan color palette ─────────────────────────────────────────────────────
// Uses inline styles (not Tailwind classes) so dynamic values are never purged.
const CALENDAR_COLORS = [
  { bg: "rgba(224,122,95,0.12)",  border: "rgba(224,122,95,0.35)",  text: "#E07A5F", badge: "rgba(224,122,95,0.20)"  }, // coral (brand)
  { bg: "rgba(74,124,89,0.12)",   border: "rgba(74,124,89,0.35)",   text: "#4A7C59", badge: "rgba(74,124,89,0.20)"   }, // sage
  { bg: "rgba(212,160,23,0.12)",  border: "rgba(212,160,23,0.35)",  text: "#B8860B", badge: "rgba(212,160,23,0.20)"  }, // warm gold
  { bg: "rgba(190,100,120,0.12)", border: "rgba(190,100,120,0.35)", text: "#BE6478", badge: "rgba(190,100,120,0.20)" }, // dusty rose
  { bg: "rgba(52,130,140,0.12)",  border: "rgba(52,130,140,0.35)",  text: "#34828C", badge: "rgba(52,130,140,0.20)"  }, // warm teal
  { bg: "rgba(120,100,155,0.12)", border: "rgba(120,100,155,0.35)", text: "#78649B", badge: "rgba(120,100,155,0.20)" }, // warm purple
  { bg: "rgba(160,82,45,0.12)",   border: "rgba(160,82,45,0.35)",   text: "#A0522D", badge: "rgba(160,82,45,0.20)"   }, // clay
  { bg: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.35)", text: "#64748B", badge: "rgba(100,116,139,0.20)" }, // warm slate
] as const;

type PlanColor = typeof CALENDAR_COLORS[number];

function hashTemplateColor(id: string): PlanColor {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return CALENDAR_COLORS[Math.abs(h) % CALENDAR_COLORS.length];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** 4px hit slop so the 36px month controls below lg still give a 44px touch target. */
const CALENDAR_HIT_SLOP =
  "relative after:absolute after:-inset-1 after:content-[''] lg:after:hidden";

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ScheduleCalendarProps {
  templates: TemplateWithMealsAndSchedules[];
  onUpdate: () => void;
}

interface ScheduleEntry {
  scheduleId: string;
  templateId: string;
  templateName: string;
  duration: number;
  startDate: Date;
  status: string;
}

interface ScheduledCellInfo {
  scheduleId: string;
  templateId: string;
  templateName: string;
  dayNumber: number; // 1-based position within the schedule
  color: PlanColor;
}

// ── Draggable Template Card ───────────────────────────────────────────────────

function DraggableTemplateItem({
  template,
}: {
  template: TemplateWithMealsAndSchedules;
}) {
  const t = useTranslations("mealPlans");
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `cal-tpl-${template.id}`,
    data: { templateId: template.id },
  });

  const activeSchedules =
    template.schedules?.filter((s) => s.status === "active").length ?? 0;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative px-3 py-1.5 lg:p-3 rounded-xl border transition-all duration-200 cursor-grab active:cursor-grabbing select-none [-webkit-touch-callout:none]",
        "shrink-0 w-[200px] snap-start lg:w-auto",
        "bg-muted border-border hover:border-brand-300/60 dark:hover:border-brand-500/40",
        "hover:shadow-md hover:-translate-y-0.5",
        isDragging && "opacity-40 scale-95"
      )}
      {...attributes}
      {...listeners}
    >
      <div
        className="absolute left-0 top-2 bottom-2 lg:top-3 lg:bottom-3 w-0.5 rounded-full ml-0"
        style={{ backgroundColor: hashTemplateColor(template.id).text }}
      />
      <div className="flex items-start gap-2 pl-2">
        <GripVertical className="w-3.5 h-3.5 mt-0.5 text-muted-foreground/40 flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-0.5 lg:space-y-1">
          <p className="font-display font-semibold text-sm text-foreground leading-tight line-clamp-1">
            {template.name}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>
              {template.duration} {template.duration === 1 ? t("calendar.day") : t("calendar.days")}
            </span>
            {activeSchedules > 0 && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>
                  {activeSchedules}{" "}
                  {activeSchedules === 1 ? t("calendar.schedule") : t("calendar.schedules")}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Day details (shared by popover and bottom sheet) ─────────────────────────

type CellMeal = TemplateWithMealsAndSchedules["days"][number]["meals"][number];

function DayDetailsBody({
  scheduledInfo,
  meals,
  onUnschedule,
}: {
  scheduledInfo: ScheduledCellInfo;
  meals: CellMeal[];
  onUnschedule: () => void;
}) {
  const t = useTranslations("mealPlans");
  const withRecipe = meals.filter((m) => m.recipe);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: scheduledInfo.color.badge, color: scheduledInfo.color.text }}
          >
            {t("calendar.dayNumber", { number: scheduledInfo.dayNumber })}
          </span>
          <span className="text-sm font-display font-medium text-foreground line-clamp-1">
            {scheduledInfo.templateName}
          </span>
        </div>
        <button
          type="button"
          className="relative w-7 h-7 touch:w-11 touch:h-11 flex items-center justify-center rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground flex-shrink-0"
          onClick={onUnschedule}
          aria-label={t("calendar.removeScheduleAction")}
        >
          <X className="w-3.5 h-3.5 touch:w-4 touch:h-4" />
        </button>
      </div>

      {withRecipe.length > 0 ? (
        <div className="space-y-2 pl-1">
          {withRecipe.map((meal, idx) => (
            <div
              key={meal.id ?? idx}
              className="flex items-center gap-3 p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
            >
              <Avatar className="w-10 h-10 rounded-lg flex-shrink-0 border border-border/50">
                {meal.recipe?.imageUrl ? (
                  <AvatarImage
                    src={meal.recipe.imageUrl}
                    alt={meal.recipe.title || t("calendar.recipe")}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback className="rounded-lg bg-brand-50 dark:bg-brand-500/10">
                  <Utensils className="w-4 h-4 text-brand-500" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-brand-500 dark:text-brand-600 uppercase tracking-wider capitalize">
                  {meal.mealType}
                </p>
                <p className="text-sm font-medium text-foreground line-clamp-2 sm:line-clamp-1">
                  {meal.recipe?.title || t("calendar.unknownRecipe")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {meal.servings} {meal.servings === 1 ? t("serving") : t("servings")}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic pl-1">{t("calendar.noMealsForDay")}</p>
      )}
    </div>
  );
}

// ── Tap-to-schedule plan picker (tap alternative to dragging a plan) ─────────

function SchedulePlanPicker({
  date,
  templates,
  pending,
  onOpenChange,
  onPick,
}: {
  date: Date | null;
  templates: TemplateWithMealsAndSchedules[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (templateId: string) => void;
}) {
  const t = useTranslations("mealPlans");
  const dateLabel = date
    ? new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(date)
    : "";

  return (
    <Dialog open={date !== null} onOpenChange={onOpenChange}>
      <DialogContent
        mobileSheet
        className="max-w-md p-0 gap-0 overflow-hidden max-sm:overflow-hidden max-sm:pb-0 flex flex-col sm:max-h-[80dvh]"
      >
        <DialogHeader className="p-5 pb-3 pr-12 text-left">
          <DialogTitle className="font-display text-lg tracking-tight">
            {t("calendar.pickPlanTitle")}
          </DialogTitle>
          <DialogDescription>{t("calendar.pickPlanStarting", { date: dateLabel })}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] scrollbar-thin">
          {templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
                <CalendarDays className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground max-w-[260px]">{t("calendar.pickPlanEmpty")}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {templates.map((tpl) => (
                <li key={tpl.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onPick(tpl.id)}
                    className={cn(
                      "flex items-center gap-3 w-full min-h-11 px-3 py-2.5 text-left rounded-xl border border-border bg-card transition-all duration-150 cursor-pointer",
                      "hover:border-brand-500 hover:bg-brand-50/40 dark:hover:bg-brand-500/5 active:scale-[0.99]",
                      "disabled:opacity-50 disabled:pointer-events-none"
                    )}
                  >
                    <span
                      aria-hidden
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: hashTemplateColor(tpl.id).text }}
                    />
                    <span className="flex-1 min-w-0 font-display font-semibold text-sm text-foreground truncate">
                      {tpl.name}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      {tpl.duration} {tpl.duration === 1 ? t("calendar.day") : t("calendar.days")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Droppable Calendar Cell ───────────────────────────────────────────────────

function CalendarCell({
  date,
  inMonth,
  isToday,
  scheduledInfo,
  templates,
  onUnschedule,
  onPickDay,
}: {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  scheduledInfo: ScheduledCellInfo | null;
  templates: TemplateWithMealsAndSchedules[];
  onUnschedule: (scheduleId: string) => void;
  onPickDay: (date: Date) => void;
}) {
  const t = useTranslations("mealPlans");
  const iso = isoOf(date);
  const today = startOfDay(new Date());
  const isPast = !canScheduleOn(date, today);
  // Empty, non-past days open the plan picker on tap/click (every tier).
  const canPick = !scheduledInfo && !isPast;
  const isPhone = useViewportTier() === "phone";
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: `cal-date-${iso}`,
    data: { date },
  });

  const meals = (() => {
    if (!scheduledInfo) return [];
    const tpl = templates.find((tpl) => tpl.id === scheduledInfo.templateId);
    if (!tpl) return [];
    const day = tpl.days.find((d) => d.dayNumber === scheduledInfo.dayNumber);
    return day?.meals ?? [];
  })();
  const mealCount = meals.filter((m) => m.recipe).length;

  const handleUnschedule = () => {
    setDetailsOpen(false);
    if (scheduledInfo) onUnschedule(scheduledInfo.scheduleId);
  };

  const weekdayLabel = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date);
  const dateFullLabel = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" }).format(date);

  const cellDiv = (
    <div
      ref={setNodeRef}
      {...(scheduledInfo
        ? {
            role: "button",
            tabIndex: 0,
            "aria-label": `${scheduledInfo.templateName}, ${dateFullLabel}`,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setDetailsOpen(true);
              }
            },
          }
        : canPick
          ? {
              role: "button",
              tabIndex: 0,
              "aria-label": t("calendar.scheduleOnDay", { date: dateFullLabel }),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPickDay(date);
                }
              },
            }
          : {})}
      className={cn(
        "min-h-11 sm:min-h-[90px] p-1 sm:p-2 rounded-lg border transition-all duration-150 relative",
        !inMonth && "opacity-30",
        inMonth && !scheduledInfo && "border-border bg-transparent",
        inMonth && scheduledInfo && "border-transparent",
        isPast && inMonth && !scheduledInfo && "opacity-50",
        isToday && !scheduledInfo && "border-[1.5px] border-brand-500",
        canPick && !isOver && "hover:border-brand-300 dark:hover:border-brand-500/50 active:bg-muted/60",
        isOver && "bg-brand-50/60 dark:bg-brand-500/10 ring-2 ring-brand-500/40 ring-inset border-brand-400/50",
        scheduledInfo ? "cursor-pointer" : isOver ? "cursor-copy" : canPick ? "cursor-pointer" : "cursor-default"
      )}
      onClick={
        isPhone && scheduledInfo
          ? () => setDetailsOpen(true)
          : canPick
            ? () => onPickDay(date)
            : undefined
      }
      onMouseEnter={() => { if (scheduledInfo) setIsHovered(true); }}
      onMouseLeave={() => setIsHovered(false)}
      style={
        scheduledInfo && !isOver
          ? {
              backgroundColor: scheduledInfo.color.bg,
              borderColor: isToday ? "var(--color-brand-500)" : scheduledInfo.color.border,
              borderWidth: isToday ? 1.5 : 1,
              borderStyle: "solid",
              boxShadow: isHovered ? `0 0 0 2px ${scheduledInfo.color.text}` : undefined,
            }
          : undefined
      }
    >
      {/* Day number */}
      <div className="flex items-center justify-between mb-0.5 sm:mb-1">
        <span
          className={cn(
            "inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 text-[13px] sm:text-sm rounded-full font-medium",
            !inMonth && "text-muted-foreground/50",
            inMonth && !isToday && !scheduledInfo && "text-muted-foreground",
            inMonth && scheduledInfo && !isToday && "text-foreground font-semibold",
            isToday && "text-brand-500 font-bold"
          )}
        >
          {date.getDate()}
        </span>
        {isToday && !scheduledInfo && (
          <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
        )}
      </div>

      {/* Schedule marker: dot + meal count on phones, labelled badge from sm up */}
      {scheduledInfo && (
        <>
          <div className="sm:hidden flex items-center justify-center gap-1 mt-0.5">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: scheduledInfo.color.text }}
            />
            {mealCount > 0 && (
              <span className="text-xs font-semibold text-foreground leading-none">{mealCount}</span>
            )}
          </div>
          <div
            className="hidden sm:block mt-1 px-2 py-1 rounded-md"
            style={{ backgroundColor: scheduledInfo.color.text }}
          >
            <p className="text-[10px] touch:text-xs font-bold leading-tight line-clamp-1" style={{ color: "#1C1A17" }}>
              {scheduledInfo.templateName}
            </p>
            <p className="text-[10px] touch:text-xs mt-0.5" style={{ color: "rgba(28,26,23,0.75)" }}>
              {t("calendar.dayNumber", { number: scheduledInfo.dayNumber })}
            </p>
          </div>
        </>
      )}
    </div>
  );

  if (!scheduledInfo) return cellDiv;

  if (isPhone) {
    return (
      <>
        {cellDiv}
        <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[85dvh] rounded-t-2xl gap-0 pb-[env(safe-area-inset-bottom)]"
          >
            <SheetHeader className="pr-12 border-b border-border/50">
              <SheetDescription className="text-xs font-medium text-brand-500 dark:text-brand-600 uppercase tracking-wider capitalize">
                {weekdayLabel}
              </SheetDescription>
              <SheetTitle className="font-display text-lg tracking-tight capitalize">
                {dateFullLabel}
              </SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto p-4">
              <DayDetailsBody
                scheduledInfo={scheduledInfo}
                meals={meals}
                onUnschedule={handleUnschedule}
              />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={detailsOpen} onOpenChange={setDetailsOpen}>
      <PopoverTrigger asChild>{cellDiv}</PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-96 p-0" align="start">
        <div className="max-h-[440px] overflow-y-auto p-4">
          <div className="mb-4 pb-3 border-b border-border/50">
            <p className="text-xs font-medium text-brand-500 dark:text-brand-600 uppercase tracking-wider mb-1 capitalize">
              {weekdayLabel}
            </p>
            <h4 className="font-display font-semibold text-lg text-foreground tracking-tight capitalize">
              {dateFullLabel}
            </h4>
          </div>
          <DayDetailsBody
            scheduledInfo={scheduledInfo}
            meals={meals}
            onUnschedule={handleUnschedule}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ScheduleCalendar({ templates, onUpdate }: ScheduleCalendarProps) {
  const t = useTranslations("mealPlans");
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [isPending, startTransition] = useTransition();
  const [draggedTemplateId, setDraggedTemplateId] = useState<string | null>(null);
  // Day the tap-to-schedule picker targets; null while closed.
  const [pickDate, setPickDate] = useState<Date | null>(null);
  const [unscheduleDialogOpen, setUnscheduleDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
  const touchFirst = useIsTouchFirst();
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // ── Flatten active schedules from all templates ────────────────────────────

  const schedules: ScheduleEntry[] = templates.flatMap((tpl) =>
    (tpl.schedules ?? [])
      .filter((s) => s.status !== "cancelled")
      .map((s) => ({
        scheduleId: s.id,
        templateId: tpl.id,
        templateName: tpl.name,
        duration: tpl.duration,
        startDate: startOfDay(new Date(s.startDate)),
        status: s.status,
      }))
  );

  // ── Build date-to-schedule map ─────────────────────────────────────────────

  function getScheduledInfo(date: Date): ScheduledCellInfo | null {
    const ts = date.getTime();
    for (const entry of schedules) {
      const start = entry.startDate.getTime();
      const end = addDays(entry.startDate, entry.duration - 1).getTime();
      if (ts >= start && ts <= end) {
        return {
          scheduleId: entry.scheduleId,
          templateId: entry.templateId,
          templateName: entry.templateName,
          dayNumber: Math.floor((ts - start) / (1000 * 60 * 60 * 24)) + 1,
          color: hashTemplateColor(entry.templateId),
        };
      }
    }
    return null;
  }

  // ── Calendar cell computation ───────────────────────────────────────────────

  const today = startOfDay(new Date());
  const firstOfMonth = new Date(month.y, month.m, 1);
  const startWeekday = firstOfMonth.getDay(); // 0=Sun
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();

  const cells: Array<{ inMonth: boolean; date: Date }> = [];

  // Leading days from previous month
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ inMonth: false, date: new Date(month.y, month.m, -i) });
  }
  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ inMonth: true, date: new Date(month.y, month.m, d) });
  }
  // Trailing days to complete the last week row
  while (cells.length % 7 !== 0) {
    const overflow = cells.length - startWeekday - daysInMonth + 1;
    cells.push({ inMonth: false, date: new Date(month.y, month.m + 1, overflow) });
  }

  // ── Month navigation ────────────────────────────────────────────────────────

  const prevMonth = () =>
    setMonth((m) => ({
      y: m.m === 0 ? m.y - 1 : m.y,
      m: (m.m + 11) % 12,
    }));

  const nextMonth = () =>
    setMonth((m) => ({
      y: m.m === 11 ? m.y + 1 : m.y,
      m: (m.m + 1) % 12,
    }));

  const goToToday = () =>
    setMonth({ y: today.getFullYear(), m: today.getMonth() });

  // ── Intl formatters ─────────────────────────────────────────────────────────

  const monthName = new Intl.DateTimeFormat(undefined, { month: "long" }).format(
    new Date(month.y, month.m, 1)
  );

  const weekdayNames = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(undefined, { weekday: "short" })
      .format(new Date(2024, 0, 7 + i)) // Jan 7 2024 = Sunday
      .toUpperCase()
  );

  // ── Scheduling (shared by drag-and-drop and the tap picker) ────────────────

  const schedulePlanOnDate = (templateId: string, date: Date, onScheduled?: () => void) => {
    // Reject past dates
    const target = startOfDay(date);
    if (!canScheduleOn(target, today)) {
      toast.error(t("calendar.errors.pastDate"));
      return;
    }

    const template = templates.find((tpl) => tpl.id === templateId);
    if (!template) return;

    if (overlapsSchedule(target, template.duration, schedules)) {
      toast.error(t("calendar.errors.overlap"));
      return;
    }

    startTransition(async () => {
      const result = await scheduleMealPlan(templateId, target);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(t("calendar.scheduledSuccess"));
        onScheduled?.();
        onUpdate();
      }
    });
  };

  // ── Drag & drop handlers ────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    const templateId = event.active.data.current?.templateId as string | undefined;
    setDraggedTemplateId(templateId ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedTemplateId(null);

    if (!over) return;

    const templateId = active.data.current?.templateId as string | undefined;
    const targetDate = over.data.current?.date as Date | undefined;

    if (!templateId || !targetDate) return;

    schedulePlanOnDate(templateId, targetDate);
  };

  // ── Unschedule flow ─────────────────────────────────────────────────────────

  const handleUnschedule = (scheduleId: string) => {
    setScheduleToDelete(scheduleId);
    setUnscheduleDialogOpen(true);
  };

  const confirmUnschedule = () => {
    if (!scheduleToDelete) return;
    const id = scheduleToDelete;
    startTransition(async () => {
      const result = await unscheduleMealPlan(id);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(t("calendar.unscheduledSuccess"));
        onUpdate();
      }
      setUnscheduleDialogOpen(false);
      setScheduleToDelete(null);
    });
  };

  // ── Dragged template name (for overlay) ────────────────────────────────────

  const draggedTemplate = draggedTemplateId
    ? templates.find((t) => t.id === draggedTemplateId) ?? null
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-3 sm:gap-4 lg:gap-5 grid-cols-1 lg:grid-cols-[260px_1fr]">
          {/* ── Left rail: template list ─────────────────────────────────── */}
          <div className="bg-card border border-border rounded-[14px] p-3.5 sm:p-4 space-y-2.5 lg:space-y-3">
            <div>
              <p className="font-display text-[17px] font-semibold text-foreground">
                {t("calendar.yourMealPlans")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {touchFirst ? t("calendar.tapOrDragInstruction") : t("calendar.clickOrDragInstruction")}
              </p>
            </div>

            {templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
                  <CalendarDays className="w-6 h-6 text-muted-foreground/40" />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("calendar.noPlansAvailable")}
                </p>
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto overscroll-x-contain snap-x snap-proximity pb-2 -mx-1 px-1 scroll-px-1 scrollbar-thin lg:block lg:space-y-2 lg:overflow-visible lg:pb-0 lg:mx-0 lg:px-0">
                {templates.map((tpl) => (
                  <DraggableTemplateItem key={tpl.id} template={tpl} />
                ))}
              </div>
            )}
          </div>

          {/* ── Calendar ─────────────────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-[14px] p-3.5 sm:p-5 min-w-0">
            {/* Calendar header — 36px controls below lg with a hit slop up to 44px */}
            <div className="flex items-center justify-between mb-3 lg:mb-5 gap-2">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={prevMonth}
                  className={cn(
                    "w-8 h-8 max-lg:w-9 max-lg:h-9 lg:touch:w-11 lg:touch:h-11 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/70 transition-colors",
                    CALENDAR_HIT_SLOP
                  )}
                  aria-label={t("calendar.prevMonth")}
                >
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>

                <div className="min-w-[100px] sm:min-w-[140px] text-center">
                  <p className="font-display text-xl lg:text-2xl max-lg:leading-tight font-semibold text-foreground capitalize">
                    {monthName}
                  </p>
                  <p className="text-xs text-muted-foreground">{month.y}</p>
                </div>

                <button
                  onClick={nextMonth}
                  className={cn(
                    "w-8 h-8 max-lg:w-9 max-lg:h-9 lg:touch:w-11 lg:touch:h-11 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/70 transition-colors",
                    CALENDAR_HIT_SLOP
                  )}
                  aria-label={t("calendar.nextMonth")}
                >
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <button
                onClick={goToToday}
                className={cn(
                  "px-3 py-1.5 max-lg:min-h-9 lg:touch:min-h-11 rounded-lg border border-border bg-transparent text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors",
                  CALENDAR_HIT_SLOP
                )}
              >
                {t("calendar.today")}
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-1 sm:mb-2">
              {weekdayNames.map((name) => (
                <div
                  key={name}
                  className="text-xs font-bold tracking-wider text-muted-foreground px-0.5 py-1 text-center sm:text-left sm:tracking-widest"
                >
                  {name}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell, i) => {
                const iso = isoOf(cell.date);
                const isToday =
                  cell.date.getFullYear() === today.getFullYear() &&
                  cell.date.getMonth() === today.getMonth() &&
                  cell.date.getDate() === today.getDate();
                const scheduledInfo = getScheduledInfo(startOfDay(cell.date));

                return (
                  <CalendarCell
                    key={`${iso}-${i}`}
                    date={cell.date}
                    inMonth={cell.inMonth}
                    isToday={isToday}
                    scheduledInfo={scheduledInfo}
                    templates={templates}
                    onUnschedule={handleUnschedule}
                    onPickDay={setPickDate}
                  />
                );
              })}
            </div>

            {/* Legend: plan colours as dot chips (the same dots the day cells and the
                plan picker use), then the usage hint on its own line */}
            <div className="mt-3 pt-3 lg:mt-4 lg:pt-4 border-t border-border/40 space-y-2.5">
              <ul className="flex flex-wrap gap-1.5">
                <li className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-border/60 bg-muted/40 text-xs text-muted-foreground">
                  <span aria-hidden className="w-2.5 h-2.5 rounded-full border-[1.5px] border-brand-500 flex-shrink-0" />
                  {t("calendar.today")}
                </li>
                {templates.length === 0 && (
                  <li className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-border/60 bg-muted/40 text-xs text-muted-foreground">
                    <span aria-hidden className="w-2.5 h-2.5 rounded-full bg-brand-500 flex-shrink-0" />
                    {t("calendar.scheduledLegend")}
                  </li>
                )}
                {templates.map((tpl) => (
                  <li
                    key={tpl.id}
                    title={tpl.name}
                    className="inline-flex items-center gap-1.5 h-7 min-w-0 max-w-full px-2.5 rounded-full border border-border/60 bg-muted/40 text-xs text-foreground/80"
                  >
                    <span
                      aria-hidden
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: hashTemplateColor(tpl.id).text }}
                    />
                    <span className="truncate max-w-[160px] sm:max-w-[220px]">{tpl.name}</span>
                  </li>
                ))}
              </ul>
              {templates.length > 0 && (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info aria-hidden className="w-3.5 h-3.5 mt-px flex-shrink-0" />
                  {touchFirst ? t("calendar.tapToUnschedule") : t("calendar.clickToUnschedule")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {draggedTemplate ? (
            <div className="w-56 p-3 rounded-xl bg-card border border-brand-300 dark:border-brand-500/40 shadow-xl shadow-brand-500/20">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-brand-100 dark:bg-brand-500/20">
                  <CalendarDays className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-sm text-foreground truncate">
                    {draggedTemplate.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {draggedTemplate.duration}{" "}
                    {draggedTemplate.duration === 1 ? t("calendar.day") : t("calendar.days")}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <SchedulePlanPicker
        date={pickDate}
        templates={templates}
        pending={isPending}
        onOpenChange={(open) => {
          if (!open) setPickDate(null);
        }}
        onPick={(templateId) => {
          if (pickDate) schedulePlanOnDate(templateId, pickDate, () => setPickDate(null));
        }}
      />

      {/* Unschedule confirmation dialog */}
      <AlertDialog open={unscheduleDialogOpen} onOpenChange={setUnscheduleDialogOpen}>
        <AlertDialogContent mobileSheet className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-lg">
              {t("calendar.removeScheduleTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {t("calendar.removeScheduleDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl max-sm:h-11">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmUnschedule}
              className="rounded-xl max-sm:h-11 bg-destructive hover:bg-destructive/90"
            >
              {t("calendar.removeScheduleAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
