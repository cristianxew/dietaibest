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
  CalendarDays,
  Sparkles,
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

const CONTAINER_HEIGHT = "h-[calc(100vh-12rem)]";

// Refined color palette matching the Culinary Elegance design system
const TEMPLATE_COLORS = [
  {
    bg: "bg-brand-50/80 dark:bg-brand-500/10",
    border: "border-brand-200/60 dark:border-brand-500/30",
    badge: "bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-400",
    accent: "bg-brand-500",
    hover: "hover:border-brand-300 dark:hover:border-brand-500/50",
  },
  {
    bg: "bg-sage-50/80 dark:bg-sage-500/10",
    border: "border-sage-200/60 dark:border-sage-500/30",
    badge: "bg-sage-100 dark:bg-sage-500/20 text-sage-700 dark:text-sage-400",
    accent: "bg-sage-500",
    hover: "hover:border-sage-300 dark:hover:border-sage-500/50",
  },
  {
    bg: "bg-gold-50/80 dark:bg-gold-500/10",
    border: "border-gold-200/60 dark:border-gold-500/30",
    badge: "bg-gold-100 dark:bg-gold-500/20 text-gold-700 dark:text-gold-400",
    accent: "bg-gold-500",
    hover: "hover:border-gold-300 dark:hover:border-gold-500/50",
  },
  {
    bg: "bg-purple-50/80 dark:bg-purple-500/10",
    border: "border-purple-200/60 dark:border-purple-500/30",
    badge: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400",
    accent: "bg-purple-500",
    hover: "hover:border-purple-300 dark:hover:border-purple-500/50",
  },
  {
    bg: "bg-sky-50/80 dark:bg-sky-500/10",
    border: "border-sky-200/60 dark:border-sky-500/30",
    badge: "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400",
    accent: "bg-sky-500",
    hover: "hover:border-sky-300 dark:hover:border-sky-500/50",
  },
  {
    bg: "bg-rose-50/80 dark:bg-rose-500/10",
    border: "border-rose-200/60 dark:border-rose-500/30",
    badge: "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400",
    accent: "bg-rose-500",
    hover: "hover:border-rose-300 dark:hover:border-rose-500/50",
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
  onUpdate: () => void;
}

interface DraggableTemplateCardProps {
  template: TemplateWithMealsAndSchedules;
  colorIndex: number;
  allTemplates: TemplateWithMealsAndSchedules[];
}

function DraggableTemplateCard({ template, allTemplates }: DraggableTemplateCardProps) {
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

  const color = getTemplateColor(template.id, allTemplates);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group relative p-4 rounded-2xl border transition-all duration-300 cursor-grab active:cursor-grabbing",
        "bg-card/80 backdrop-blur-sm",
        "hover:shadow-lg hover:-translate-y-0.5",
        color.border,
        color.hover,
        isDragging && "opacity-50 scale-95"
      )}
      {...attributes}
      {...listeners}
    >
      {/* Color accent bar */}
      <div className={cn("absolute left-0 top-4 bottom-4 w-1 rounded-full", color.accent)} />

      <div className="flex items-start gap-3 pl-3">
        <div className="flex-shrink-0 mt-0.5 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors">
          <GripVertical className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <h4 className="font-display font-semibold text-sm text-foreground line-clamp-1 tracking-tight">
            {template.name}
          </h4>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {template.duration} {template.duration === 1 ? t("calendar.day") : t("calendar.days")}
            </span>
          </div>

          {activeSchedulesCount > 0 && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-medium px-2 py-0.5 rounded-full",
                color.badge
              )}
            >
              {activeSchedulesCount} {activeSchedulesCount === 1 ? t("calendar.schedule") : t("calendar.schedules")}
            </Badge>
          )}
        </div>
      </div>
    </div>
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
  templates: TemplateWithMealsAndSchedules[];
  onUnschedule: (scheduleId: string) => void;
}

function MealDayPopover({
  date,
  schedules,
  templates,
  onUnschedule,
}: MealDayPopoverProps) {
  const t = useTranslations("mealPlans");

  if (schedules.length === 0) {
    return null;
  }

  return (
    <div className="w-80 max-h-[400px] overflow-y-auto p-4">
      {/* Header */}
      <div className="mb-4 pb-3 border-b border-border/50">
        <p className="text-xs font-medium text-brand-600 dark:text-brand-400 uppercase tracking-wider mb-1">
          {format(date, "EEEE")}
        </p>
        <h4 className="font-display font-semibold text-lg text-foreground tracking-tight">
          {format(date, "MMMM d, yyyy")}
        </h4>
      </div>

      <div className="space-y-4">
        {schedules.map(({ schedule, dayNumber, meals }) => {
          const color = getTemplateColor(schedule.templateId, templates);

          return (
            <div key={schedule.id} className="space-y-3">
              {/* Schedule Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Badge
                    className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                      color.badge
                    )}
                  >
                    {t("calendar.dayPrefix")} {dayNumber}
                  </Badge>
                  <span className="text-sm font-display font-medium text-foreground line-clamp-1">
                    {schedule.template.name}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                  onClick={() => onUnschedule(schedule.id)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Meals List */}
              {meals.length > 0 ? (
                <div className="space-y-2 pl-1">
                  {meals
                    .filter((meal) => meal.recipe)
                    .map((meal, idx) => (
                      <div
                        key={idx}
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
                          <p className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wider">
                            {meal.mealType}
                          </p>
                          <p className="text-sm font-medium text-foreground line-clamp-1">
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
                <p className="text-xs text-muted-foreground italic pl-1">
                  {t("calendar.noMealsPlanned")}
                </p>
              )}
            </div>
          );
        })}
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
  const today = startOfDay(new Date());
  const isPastDay = isBefore(date, today);
  const hasSchedules = schedules.length > 0;
  const isDisabled = isPastDay && !hasSchedules;
  const isTodayDate = isToday(date);

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
        "relative min-h-[100px] p-2 transition-all duration-200",
        "border-b border-r border-border/40",
        // Background states
        !isCurrentMonth && "bg-muted/30",
        isCurrentMonth && "bg-card/50",
        hasSchedules && templateColor && templateColor.bg,
        // Hover and interaction states
        !isDisabled && "hover:bg-muted/50",
        isOver && !isDisabled && "bg-brand-50/50 dark:bg-brand-500/5 ring-2 ring-brand-500/30 ring-inset",
        // Disabled state
        isDisabled && "opacity-40 cursor-not-allowed",
        // Today highlight
        isTodayDate && "ring-2 ring-brand-500/50 ring-inset"
      )}
    >
      {/* Day Number */}
      <div className="flex items-center justify-between mb-1.5">
        <span
          className={cn(
            "inline-flex items-center justify-center w-7 h-7 text-sm font-medium rounded-full transition-colors",
            !isCurrentMonth && "text-muted-foreground/50",
            isCurrentMonth && "text-foreground",
            isTodayDate && "bg-brand-500 text-white font-semibold"
          )}
        >
          {format(date, "d")}
        </span>

        {schedules.length > 1 && (
          <Badge
            variant="secondary"
            className="text-[10px] h-5 px-1.5 rounded-full bg-muted font-medium"
          >
            +{schedules.length - 1}
          </Badge>
        )}
      </div>

      {/* Scheduled Plans */}
      {schedules.length > 0 && (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button className="w-full text-left focus:outline-none focus:ring-2 focus:ring-brand-500/30 rounded-lg">
              <div className="space-y-1">
                {schedules.slice(0, 2).map(({ schedule, dayNumber }) => {
                  const color = getTemplateColor(schedule.templateId, templates);
                  return (
                    <div
                      key={schedule.id}
                      className={cn(
                        "flex items-center gap-1.5 p-1.5 rounded-lg text-xs transition-all duration-200",
                        "hover:scale-[1.02] hover:shadow-sm cursor-pointer",
                        color.badge
                      )}
                    >
                      <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", color.accent)} />
                      <span className="font-medium truncate flex-1">
                        {schedule.template.name}
                      </span>
                      <span className="text-[10px] opacity-70">
                        D{dayNumber}
                      </span>
                    </div>
                  );
                })}
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="p-0 w-auto border-border/60 shadow-xl rounded-2xl overflow-hidden"
            align="start"
            sideOffset={8}
          >
            <MealDayPopover
              date={date}
              schedules={schedules}
              templates={templates}
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

      if (isDisabled) {
        toast.error(t("calendar.errors.pastDate"));
        return;
      }

      const today = startOfDay(new Date());
      if (isBefore(targetDate, today)) {
        toast.error(t("calendar.errors.pastDate"));
        return;
      }

      const endDate = addDays(targetDate, duration - 1);

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

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-6">
      <DndContext
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        collisionDetection={closestCenter}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Meal Plans Sidebar */}
          <div className={cn("lg:sticky lg:top-6", CONTAINER_HEIGHT)}>
            <Card className="h-full flex flex-col border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden">
              {/* Header with gradient accent */}
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-100/50 to-gold-100/30 dark:from-brand-500/10 dark:to-gold-500/5" />
                <CardHeader className="relative pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-brand-500/10 dark:bg-brand-500/20">
                      <Sparkles className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    </div>
                    <div>
                      <CardTitle className="font-display text-base tracking-tight">
                        {t("calendar.yourMealPlans")}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {t("calendar.dragInstruction")}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </div>

              <CardContent className="flex-1 min-h-0 pt-0 overflow-hidden">
                <ScrollArea className="h-full -mr-4 pr-4">
                  <div className="space-y-3 py-2">
                    {savedPlans.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                          <CalendarDays className="w-8 h-8 text-muted-foreground/40" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t("calendar.noPlansAvailable")}
                        </p>
                      </div>
                    ) : (
                      savedPlans.map((template, index) => (
                        <DraggableTemplateCard
                          key={template.id}
                          template={template}
                          colorIndex={index}
                          allTemplates={savedPlans}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Calendar */}
          <Card className={cn("flex flex-col border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden", CONTAINER_HEIGHT)}>
            {/* Calendar Header */}
            <CardHeader className="flex-shrink-0 border-b border-border/40 bg-gradient-to-r from-muted/30 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goToPreviousMonth}
                    className="h-9 w-9 rounded-xl hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-400 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>

                  <div className="min-w-[180px] text-center">
                    <h3 className="font-display text-xl font-semibold text-foreground tracking-tight">
                      {format(currentMonth, "MMMM")}
                    </h3>
                    <p className="text-xs text-muted-foreground font-medium">
                      {format(currentMonth, "yyyy")}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goToNextMonth}
                    className="h-9 w-9 rounded-xl hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-400 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToToday}
                  className="rounded-xl border-brand-200 text-brand-600 hover:bg-brand-50 hover:text-brand-700 dark:border-brand-500/30 dark:text-brand-400 dark:hover:bg-brand-500/10 transition-all"
                >
                  {t("calendar.today")}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex-1 min-h-0 flex flex-col p-0 overflow-hidden">
              {/* Week Days Header */}
              <div className="flex-shrink-0 grid grid-cols-7 border-b border-border/40">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/20"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid - Scrollable */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="grid grid-cols-7">
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
              </ScrollArea>

              {/* Legend */}
              <div className="flex-shrink-0 flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 border-t border-border/40 bg-muted/10">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center text-white text-[10px] font-bold">
                    {format(new Date(), "d")}
                  </div>
                  <span>{t("calendar.today")}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-6 h-4 rounded bg-brand-50 dark:bg-brand-500/10 border border-brand-200/60 dark:border-brand-500/30" />
                  <span>{t("calendar.scheduledLegend")}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-6 h-4 rounded bg-muted/30 border border-border/40 opacity-40" />
                  <span>{t("calendar.pastDayLegend")}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {draggedTemplate ? (
            <div className="w-72 p-4 rounded-2xl bg-card border border-brand-200 dark:border-brand-500/30 shadow-2xl shadow-brand-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-brand-100 dark:bg-brand-500/20">
                  <CalendarDays className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-display font-semibold text-sm text-foreground truncate">
                    {draggedTemplate.name}
                  </h4>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {draggedTemplate.duration}{" "}
                    {draggedTemplate.duration === 1 ? t("calendar.day") : t("calendar.days")}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Unschedule Confirmation Dialog */}
      <AlertDialog
        open={unscheduleDialogOpen}
        onOpenChange={setUnscheduleDialogOpen}
      >
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
            <AlertDialogCancel className="rounded-xl">
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmUnschedule}
              className="rounded-xl bg-destructive hover:bg-destructive/90"
            >
              {t("calendar.removeScheduleAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
