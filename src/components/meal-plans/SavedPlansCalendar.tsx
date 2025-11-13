"use client";

import { useState, useTransition, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Utensils,
  Clock,
  X,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  addDays,
  differenceInDays,
  isBefore,
  startOfDay,
} from "date-fns";
import {
  DndContext,
  DragOverlay,
  DragEndEvent,
  DragStartEvent,
  useDraggable,
  useDroppable,
  closestCenter,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { scheduleMealPlan, unscheduleMealPlan } from "@/actions/meal-plan";
import type { Prisma } from "@/generated/prisma";

// Color palette for meal plan highlighting
const TEMPLATE_COLORS = [
  {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    border: "border-blue-300 dark:border-blue-700",
    badge: "bg-blue-200 dark:bg-blue-800",
  },
  {
    bg: "bg-green-100 dark:bg-green-900/30",
    border: "border-green-300 dark:border-green-700",
    badge: "bg-green-200 dark:bg-green-800",
  },
  {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    border: "border-purple-300 dark:border-purple-700",
    badge: "bg-purple-200 dark:bg-purple-800",
  },
  {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    border: "border-orange-300 dark:border-orange-700",
    badge: "bg-orange-200 dark:bg-orange-800",
  },
  {
    bg: "bg-pink-100 dark:bg-pink-900/30",
    border: "border-pink-300 dark:border-pink-700",
    badge: "bg-pink-200 dark:bg-pink-800",
  },
  {
    bg: "bg-cyan-100 dark:bg-cyan-900/30",
    border: "border-cyan-300 dark:border-cyan-700",
    badge: "bg-cyan-200 dark:bg-cyan-800",
  },
  {
    bg: "bg-indigo-100 dark:bg-indigo-900/30",
    border: "border-indigo-300 dark:border-indigo-700",
    badge: "bg-indigo-200 dark:bg-indigo-800",
  },
  {
    bg: "bg-rose-100 dark:bg-rose-900/30",
    border: "border-rose-300 dark:border-rose-700",
    badge: "bg-rose-200 dark:bg-rose-800",
  },
];

// Helper function to get consistent color for a template
function getTemplateColor(templateId: string, allTemplates: TemplateWithMealsAndSchedules[]) {
  const index = allTemplates.findIndex((t) => t.id === templateId);
  return TEMPLATE_COLORS[index % TEMPLATE_COLORS.length];
}

// Type for template with schedules and days/meals
type TemplateWithMealsAndSchedules = Prisma.MealPlanTemplateGetPayload<{
  include: {
    days: { include: { meals: { include: { recipe: true } } } };
    schedules: true;
  };
}>;

interface SavedPlansCalendarProps {
  savedPlans: TemplateWithMealsAndSchedules[];
  // activePlan: null; // No longer used but kept for compatibility
  onUpdate: () => void;
}

interface DraggableTemplateCardProps {
  template: TemplateWithMealsAndSchedules;
}

function DraggableTemplateCard({ template }: DraggableTemplateCardProps) {
  const t = useTranslations("mealPlans");
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `template-${template.id}`,
    data: {
      type: "meal-plan-template",
      templateId: template.id,
      templateName: template.name,
      duration: template.duration,
    },
  });

  const activeSchedulesCount =
    template.schedules?.filter((s) => s.status === "active").length || 0;

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "cursor-grab hover:shadow-md transition-all",
        isDragging && "opacity-50"
      )}
      {...attributes}
      {...listeners}
    >
      <CardHeader className="p-3">
        <div className="flex items-start gap-2">
          <GripVertical className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm line-clamp-1">
              {template.name}
            </CardTitle>
            <CardDescription className="text-xs flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3" />
              {template.duration} {template.duration === 1 ? t("calendar.day") : t("calendar.days")}
            </CardDescription>
            {activeSchedulesCount > 0 && (
              <Badge variant="outline" className="mt-1 text-xs">
                {activeSchedulesCount}{" "}
                {activeSchedulesCount === 1 ? t("calendar.schedule") : t("calendar.schedules")}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

interface Schedule {
  id: string;
  templateId: string;
  startDate: Date;
  status: string;
  template: {
    id: string;
    name: string;
    duration: number;
    days?: Array<{
      id: string;
      dayNumber: number;
      meals: Array<{
        id: string;
        recipeId: string;
        mealType: string;
        servings: number;
        recipe: {
          id: string;
          title: string | null;
          imageUrl: string | null;
        } | null;
      }>;
    }>;
  };
}

interface DaySchedule {
  schedule: Schedule;
  dayNumber: number;
  meals: Array<{
    id: string;
    recipeId: string;
    mealType: string;
    servings: number;
    recipe: {
      id: string;
      title: string | null;
      imageUrl: string | null;
    } | null;
  }>;
}

interface CalendarDayProps {
  date: Date;
  isCurrentMonth: boolean;
  schedules: DaySchedule[];
  templates: TemplateWithMealsAndSchedules[];
  onUnschedule: (scheduleId: string) => void;
}

interface MealDayPopoverProps {
  date: Date;
  schedules: DaySchedule[];
  onUnschedule: (scheduleId: string) => void;
}

function MealDayPopover({
  date,
  schedules,
  onUnschedule,
}: MealDayPopoverProps) {
  const t = useTranslations("mealPlans");

  if (schedules.length === 0) {
    return null;
  }

  return (
    <div className="w-80 max-h-96 overflow-y-auto">
      <div className="mb-3">
        <h4 className="font-semibold text-sm">
          {format(date, "EEEE, MMMM d, yyyy")}
        </h4>
      </div>

      <div className="space-y-4">
        {schedules.map(({ schedule, dayNumber, meals }) => (
          <div key={schedule.id} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Badge
                  className={cn(
                    schedule.status === "active"
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100"
                  )}
                >
                  {t("calendar.dayPrefix")} {dayNumber}
                </Badge>
                <span className="text-sm font-medium line-clamp-1">
                  {schedule.template.name}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => onUnschedule(schedule.id)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>

            {meals.length > 0 ? (
              <div className="space-y-2 pl-2">
                {meals
                  .filter((meal) => meal.recipe)
                  .map((meal, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Avatar className="w-10 h-10 flex-shrink-0">
                        {meal.recipe?.imageUrl ? (
                          <AvatarImage
                            src={meal.recipe.imageUrl}
                            alt={meal.recipe.title || t("calendar.recipe")}
                          />
                        ) : null}
                        <AvatarFallback>
                          <Utensils className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground capitalize">
                          {meal.mealType}
                        </p>
                        <p className="text-sm font-medium line-clamp-1">
                          {meal.recipe?.title || t("calendar.unknownRecipe")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {meal.servings}{" "}
                          {meal.servings === 1 ? t("serving") : t("servings")}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground pl-2">
                {t("calendar.noMealsPlanned")}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarDay({
  date,
  isCurrentMonth,
  schedules,
  templates,
  onUnschedule
}: CalendarDayProps) {
  const t = useTranslations("mealPlans");
  // Check if this day is in the past
  const today = startOfDay(new Date());
  const isPastDay = isBefore(date, today);
  const hasSchedules = schedules.length > 0;
  const isDisabled = isPastDay && !hasSchedules;

  // Get color from first schedule's template (if multiple, use first)
  const firstSchedule = schedules[0];
  const templateColor = firstSchedule
    ? getTemplateColor(firstSchedule.schedule.templateId, templates)
    : null;

  const { setNodeRef, isOver } = useDroppable({
    id: `day-${format(date, "yyyy-MM-dd")}`,
    data: {
      type: "calendar-day",
      date,
      disabled: isDisabled,
    },
  });

  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleUnscheduleClick = (scheduleId: string) => {
    setPopoverOpen(false);
    onUnschedule(scheduleId);
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-24 border p-1 transition-colors",
        !isCurrentMonth && "bg-muted/50 text-muted-foreground",
        isToday(date) && "border-primary border-2",
        isOver && !isDisabled && "border-primary border-2 ring-2 ring-primary/20",
        isDisabled && "opacity-40 cursor-not-allowed bg-muted/30",
        hasSchedules && templateColor && [templateColor.bg, templateColor.border]
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            "text-sm font-medium",
            isToday(date) && "text-primary font-bold"
          )}
        >
          {format(date, "d")}
        </span>
        {schedules.length > 0 && (
          <Badge
            variant="secondary"
            className={cn(
              "text-xs h-5",
              templateColor && templateColor.badge
            )}
          >
            {schedules.length}
          </Badge>
        )}
      </div>

      {schedules.length > 0 && (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <div className="space-y-0.5 cursor-pointer">
              {schedules.slice(0, 2).map(({ schedule, dayNumber }) => {
                const color = getTemplateColor(schedule.templateId, templates);
                return (
                  <div
                    key={schedule.id}
                    className={cn(
                      "text-xs p-1 rounded truncate",
                      color.badge
                    )}
                  >
                    <div className="font-medium truncate">
                      {schedule.template.name}
                    </div>
                    <div className="text-muted-foreground">{t("calendar.dayPrefix")} {dayNumber}</div>
                  </div>
                );
              })}
              {schedules.length > 2 && (
                <div className="text-xs text-muted-foreground text-center">
                  {t("calendar.moreSchedules", { count: schedules.length - 2 })}
                </div>
              )}
            </div>
          </PopoverTrigger>
          <PopoverContent className="p-0" align="start">
            <MealDayPopover
              date={date}
              schedules={schedules}
              onUnschedule={handleUnscheduleClick}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export function SavedPlansCalendar({
  savedPlans,
  onUpdate,
}: SavedPlansCalendarProps) {
  const t = useTranslations("mealPlans");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [draggedTemplate, setDraggedTemplate] =
    useState<TemplateWithMealsAndSchedules | null>(null);
  const [, startTransition] = useTransition();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [unscheduleDialogOpen, setUnscheduleDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);

  // Extract all schedules from templates
  useEffect(() => {
    const allSchedules: Schedule[] = savedPlans.flatMap((template) =>
      (template.schedules || []).map((schedule) => ({
        ...schedule,
        startDate: new Date(schedule.startDate),
        template: {
          id: template.id,
          name: template.name,
          duration: template.duration,
          days: template.days,
        },
      }))
    );
    setSchedules(allSchedules);
  }, [savedPlans]);

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  // Get schedules for a specific date
  const getSchedulesForDate = (date: Date): DaySchedule[] => {
    return schedules
      .filter((schedule) => {
        const endDate = addDays(
          schedule.startDate,
          schedule.template.duration - 1
        );
        return isWithinInterval(date, {
          start: schedule.startDate,
          end: endDate,
        });
      })
      .map((schedule) => {
        const dayNumber = differenceInDays(date, schedule.startDate) + 1;
        const templateDay = schedule.template.days?.find(
          (d) => d.dayNumber === dayNumber
        );
        return {
          schedule,
          dayNumber,
          meals: templateDay?.meals || [],
        };
      });
  };

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === "meal-plan-template") {
      const template = savedPlans.find(
        (t) => t.id === active.data.current?.templateId
      );
      setDraggedTemplate(template || null);
    }
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setDraggedTemplate(null);

    if (!over || !active.data.current || !over.data.current) {
      return;
    }

    if (
      active.data.current.type === "meal-plan-template" &&
      over.data.current.type === "calendar-day"
    ) {
      const templateId = active.data.current.templateId;
      const duration = active.data.current.duration;
      const targetDate = over.data.current.date as Date;
      const isDisabled = over.data.current.disabled;

      // Check if trying to drop on disabled (past empty) day
      if (isDisabled) {
        toast.error(t("calendar.errors.pastDate"));
        return;
      }

      // Check if target date is in the past
      const today = startOfDay(new Date());
      if (isBefore(targetDate, today)) {
        toast.error(t("calendar.errors.pastDate"));
        return;
      }

      // Calculate end date
      const endDate = addDays(targetDate, duration - 1);

      // Check for overlapping schedules
      const hasOverlap = schedules.some((schedule) => {
        const scheduleEnd = addDays(
          schedule.startDate,
          schedule.template.duration - 1
        );
        return (
          (targetDate >= schedule.startDate && targetDate <= scheduleEnd) ||
          (endDate >= schedule.startDate && endDate <= scheduleEnd) ||
          (targetDate <= schedule.startDate && endDate >= scheduleEnd)
        );
      });

      if (hasOverlap) {
        toast.error(t("calendar.errors.overlap"));
        return;
      }

      // Schedule the meal plan
      handleScheduleTemplate(templateId, targetDate);
    }
  };

  // Schedule a meal plan
  const handleScheduleTemplate = async (
    templateId: string,
    startDate: Date
  ) => {
    startTransition(async () => {
      const result = await scheduleMealPlan(templateId, startDate);

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(t("calendar.scheduledSuccess"));
        onUpdate();
      }
    });
  };

  // Unschedule a plan
  const handleUnschedule = (scheduleId: string) => {
    setScheduleToDelete(scheduleId);
    setUnscheduleDialogOpen(true);
  };

  const confirmUnschedule = () => {
    if (!scheduleToDelete) return;

    startTransition(async () => {
      const result = await unscheduleMealPlan(scheduleToDelete);

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

  // Navigate months
  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  return (
    <div className="space-y-4">
      <DndContext
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        collisionDetection={closestCenter}
      >
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Meal Plans List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("calendar.yourMealPlans")}</CardTitle>
                <CardDescription className="text-xs">
                  {t("calendar.dragInstruction")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-2">
                    {savedPlans.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        {t("calendar.noPlansAvailable")}
                      </p>
                    ) : (
                      savedPlans.map((template) => (
                        <DraggableTemplateCard
                          key={template.id}
                          template={template}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Calendar */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPreviousMonth}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <h3 className="text-lg font-semibold">
                      {format(currentMonth, "MMMM yyyy")}
                    </h3>
                    <Button variant="outline" size="sm" onClick={goToNextMonth}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" onClick={goToToday}>
                    {t("calendar.today")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                  {/* Day Headers */}
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day) => (
                      <div
                        key={day}
                        className="bg-muted p-2 text-center text-sm font-medium"
                      >
                        {day}
                      </div>
                    )
                  )}

                  {/* Calendar Days */}
                  {calendarDays.map((date) => {
                    const schedulesForDate = getSchedulesForDate(date);
                    return (
                      <CalendarDay
                        key={date.toISOString()}
                        date={date}
                        isCurrentMonth={isSameMonth(date, currentMonth)}
                        schedules={schedulesForDate}
                        templates={savedPlans}
                        onUnschedule={handleUnschedule}
                      />
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-primary/5 border-2 border-primary rounded" />
                    <span>{t("calendar.today")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded" />
                    <span>{t("calendar.scheduledLegend")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-muted/30 border rounded opacity-40" />
                    <span>{t("calendar.pastDayLegend")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {draggedTemplate ? (
            <Card className="w-64 shadow-lg">
              <CardHeader className="p-3">
                <CardTitle className="text-sm">
                  {draggedTemplate.name}
                </CardTitle>
                <CardDescription className="text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {draggedTemplate.duration}{" "}
                  {draggedTemplate.duration === 1 ? "day" : "days"}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Unschedule Confirmation Dialog */}
      <AlertDialog
        open={unscheduleDialogOpen}
        onOpenChange={setUnscheduleDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("calendar.removeScheduleTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("calendar.removeScheduleDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnschedule}>
              {t("calendar.removeScheduleAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
