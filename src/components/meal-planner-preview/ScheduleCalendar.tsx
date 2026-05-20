"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { GripVertical, Clock, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { scheduleMealPlan, unscheduleMealPlan } from "@/actions/meal-plan";
import type { TemplateWithMealsAndSchedules } from "@/lib/meal-plan-adapter";
import { useTranslations } from "next-intl";

// ── Helpers ────────────────────────────────────────────────────────────────────

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isBefore(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime();
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
  templateName: string;
  dayNumber: number; // 1-based position within the schedule
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
        "relative p-3 rounded-xl border transition-all duration-200 cursor-grab active:cursor-grabbing",
        "bg-card/80 border-border/60 hover:border-brand-300/60 dark:hover:border-brand-500/40",
        "hover:shadow-md hover:-translate-y-0.5",
        isDragging && "opacity-40 scale-95"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-brand-500 ml-0" />
      <div className="flex items-start gap-2 pl-2">
        <GripVertical className="w-3.5 h-3.5 mt-0.5 text-muted-foreground/40 flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-1">
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

// ── Droppable Calendar Cell ───────────────────────────────────────────────────

function CalendarCell({
  date,
  inMonth,
  isToday,
  scheduledInfo,
  onCellClick,
}: {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  scheduledInfo: ScheduledCellInfo | null;
  onCellClick: (scheduleId: string) => void;
}) {
  const t = useTranslations("mealPlans");
  const iso = isoOf(date);
  const today = startOfDay(new Date());
  const isPast = isBefore(date, today) && !isToday;

  const { setNodeRef, isOver } = useDroppable({
    id: `cal-date-${iso}`,
    data: { date },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[90px] p-2 rounded-lg border transition-all duration-150 relative",
        // Base
        !inMonth && "opacity-30",
        inMonth && !scheduledInfo && "border-border/40 bg-transparent",
        inMonth && scheduledInfo && "border-brand-500/30 bg-brand-500/8",
        // Past day
        isPast && inMonth && !scheduledInfo && "opacity-50",
        // Today ring
        isToday && "ring-2 ring-brand-500/50 ring-inset border-brand-500/50",
        // Drop hover
        isOver && "bg-brand-50/60 dark:bg-brand-500/10 ring-2 ring-brand-500/40 ring-inset border-brand-400/50",
        // Cursor
        scheduledInfo ? "cursor-pointer" : isOver ? "cursor-copy" : "cursor-default"
      )}
      onClick={() => {
        if (scheduledInfo) onCellClick(scheduledInfo.scheduleId);
      }}
    >
      {/* Day number */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            "inline-flex items-center justify-center w-6 h-6 text-sm rounded-full font-medium",
            !inMonth && "text-muted-foreground/50",
            inMonth && !isToday && !scheduledInfo && "text-muted-foreground",
            inMonth && scheduledInfo && !isToday && "text-foreground font-semibold",
            isToday && "bg-brand-500 text-white font-bold"
          )}
        >
          {date.getDate()}
        </span>
        {isToday && !scheduledInfo && (
          <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
        )}
      </div>

      {/* Schedule badge */}
      {scheduledInfo && (
        <div className="mt-1 px-2 py-1 rounded-md bg-brand-500/15 border border-brand-500/30 group hover:bg-brand-500/25 transition-colors">
          <p className="text-[10px] font-bold text-brand-700 dark:text-brand-400 leading-tight line-clamp-1">
            {scheduledInfo.templateName}
          </p>
          <p className="text-[9px] text-brand-600/70 dark:text-brand-400/60 mt-0.5">
            {t("calendar.dayNumber", { number: scheduledInfo.dayNumber })}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ScheduleCalendar({ templates, onUpdate }: ScheduleCalendarProps) {
  const t = useTranslations("mealPlans");
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [, startTransition] = useTransition();
  const [draggedTemplateId, setDraggedTemplateId] = useState<string | null>(null);
  const [unscheduleDialogOpen, setUnscheduleDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);

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
          templateName: entry.templateName,
          dayNumber: Math.floor((ts - start) / (1000 * 60 * 60 * 24)) + 1,
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

    // Reject past dates
    const target = startOfDay(targetDate);
    if (isBefore(target, today)) {
      toast.error(t("calendar.errors.pastDate"));
      return;
    }

    // Overlap check
    const template = templates.find((tpl) => tpl.id === templateId);
    if (!template) return;

    const endDate = addDays(target, template.duration - 1);
    const hasOverlap = schedules.some((s) => {
      const sEnd = addDays(s.startDate, s.duration - 1);
      return (
        (target >= s.startDate && target <= sEnd) ||
        (endDate >= s.startDate && endDate <= sEnd) ||
        (target <= s.startDate && endDate >= sEnd)
      );
    });

    if (hasOverlap) {
      toast.error(t("calendar.errors.overlap"));
      return;
    }

    startTransition(async () => {
      const result = await scheduleMealPlan(templateId, target);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(t("calendar.scheduledSuccess"));
        onUpdate();
      }
    });
  };

  // ── Unschedule flow ─────────────────────────────────────────────────────────

  const handleCellClick = (scheduleId: string) => {
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
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-5" style={{ gridTemplateColumns: "260px 1fr" }}>
          {/* ── Left rail: template list ─────────────────────────────────── */}
          <div className="bg-card border border-border/60 rounded-2xl p-4 space-y-3">
            <div>
              <p className="font-display text-[17px] font-semibold text-foreground">
                {t("calendar.yourMealPlans")}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                {t("calendar.dragInstruction")}
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
              <div className="space-y-2">
                {templates.map((tpl) => (
                  <DraggableTemplateItem key={tpl.id} template={tpl} />
                ))}
              </div>
            )}
          </div>

          {/* ── Calendar ─────────────────────────────────────────────────── */}
          <div className="bg-card border border-border/60 rounded-2xl p-5">
            {/* Calendar header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={prevMonth}
                  className="w-8 h-8 rounded-lg bg-muted/60 border border-border/60 flex items-center justify-center hover:bg-muted transition-colors"
                  aria-label={t("calendar.prevMonth")}
                >
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>

                <div className="min-w-[140px] text-center">
                  <p className="font-display text-xl font-semibold text-foreground capitalize">
                    {monthName}
                  </p>
                  <p className="text-xs text-muted-foreground">{month.y}</p>
                </div>

                <button
                  onClick={nextMonth}
                  className="w-8 h-8 rounded-lg bg-muted/60 border border-border/60 flex items-center justify-center hover:bg-muted transition-colors"
                  aria-label={t("calendar.nextMonth")}
                >
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <button
                onClick={goToToday}
                className="px-3 py-1.5 rounded-lg border border-border/60 bg-transparent text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                {t("calendar.today")}
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekdayNames.map((name) => (
                <div
                  key={name}
                  className="text-[10px] font-bold tracking-widest text-muted-foreground/60 px-1 py-1"
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
                    onCellClick={handleCellClick}
                  />
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 pt-4 border-t border-border/40 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center text-white text-[10px] font-bold">
                  {today.getDate()}
                </div>
                <span>{t("calendar.today")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-8 h-4 rounded bg-brand-500/15 border border-brand-500/30" />
                <span>{t("calendar.scheduledLegend")}</span>
              </div>
              {templates.length > 0 && (
                <div className="flex items-center gap-1.5 ml-auto text-[10px] text-muted-foreground/60 italic">
                  {t("calendar.clickToUnschedule")}
                </div>
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

      {/* Unschedule confirmation dialog */}
      <AlertDialog open={unscheduleDialogOpen} onOpenChange={setUnscheduleDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-lg">
              {t("calendar.removeScheduleTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {t("calendar.removeScheduleDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmUnschedule}
              className="rounded-xl bg-destructive hover:bg-destructive/90"
            >
              {t("calendar.removeScheduleAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
