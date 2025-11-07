"use client";

import { useState, useTransition, useEffect } from "react";
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
              {template.duration} {template.duration === 1 ? "day" : "days"}
            </CardDescription>
            {activeSchedulesCount > 0 && (
              <Badge variant="outline" className="mt-1 text-xs">
                {activeSchedulesCount}{" "}
                {activeSchedulesCount === 1 ? "schedule" : "schedules"}
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
                  Day {dayNumber}
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
                            alt={meal.recipe.title || "Recipe"}
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
                          {meal.recipe?.title || "Unknown Recipe"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {meal.servings}{" "}
                          {meal.servings === 1 ? "serving" : "servings"}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground pl-2">
                No meals planned for this day
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarDay({ date, isCurrentMonth, schedules }: CalendarDayProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${format(date, "yyyy-MM-dd")}`,
    data: {
      type: "calendar-day",
      date,
    },
  });

  const [popoverOpen, setPopoverOpen] = useState(false);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-24 border p-1 transition-colors",
        !isCurrentMonth && "bg-muted/50 text-muted-foreground",
        isToday(date) && "bg-primary/5 border-primary",
        isOver && "bg-primary/10 border-primary",
        schedules.length > 0 && "bg-blue-50 dark:bg-blue-950/20"
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
          <Badge variant="secondary" className="text-xs h-5">
            {schedules.length}
          </Badge>
        )}
      </div>

      {schedules.length > 0 && (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <div className="space-y-0.5 cursor-pointer">
              {schedules.slice(0, 2).map(({ schedule, dayNumber }) => (
                <div
                  key={schedule.id}
                  className="text-xs p-1 bg-primary/10 rounded truncate"
                >
                  <div className="font-medium truncate">
                    {schedule.template.name}
                  </div>
                  <div className="text-muted-foreground">Day {dayNumber}</div>
                </div>
              ))}
              {schedules.length > 2 && (
                <div className="text-xs text-muted-foreground text-center">
                  +{schedules.length - 2} more
                </div>
              )}
            </div>
          </PopoverTrigger>
          <PopoverContent className="p-0" align="start">
            <MealDayPopover
              date={date}
              schedules={schedules}
              onUnschedule={() => {
                setPopoverOpen(false);
                // This will be handled by parent
              }}
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
        toast.error(
          "This schedule overlaps with an existing plan. Please choose different dates."
        );
        return;
      }

      // Schedule the template
      handleScheduleTemplate(templateId, targetDate);
    }
  };

  // Schedule a template
  const handleScheduleTemplate = async (
    templateId: string,
    startDate: Date
  ) => {
    startTransition(async () => {
      const result = await scheduleMealPlan(templateId, startDate);

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Template scheduled successfully!");
        onUpdate();
      }
    });
  };

  // // Unschedule a plan
  // const handleUnschedule = (scheduleId: string) => {
  //   setScheduleToDelete(scheduleId);
  //   setUnscheduleDialogOpen(true);
  // };

  const confirmUnschedule = () => {
    if (!scheduleToDelete) return;

    startTransition(async () => {
      const result = await unscheduleMealPlan(scheduleToDelete);

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Schedule removed successfully!");
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
          {/* Templates List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Your Templates</CardTitle>
                <CardDescription className="text-xs">
                  Drag templates onto calendar dates to schedule them
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-2">
                    {savedPlans.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No templates available
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
                    Today
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
                      />
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-primary/5 border border-primary rounded" />
                    <span>Today</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-50 dark:bg-blue-950/20 border rounded" />
                    <span>Scheduled</span>
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
            <AlertDialogTitle>Remove Schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this schedule from your calendar. The template
              will remain available for future use.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnschedule}>
              Remove Schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
