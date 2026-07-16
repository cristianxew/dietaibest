/**
 * Maps upcoming calendar days to meal-plan template day numbers.
 *
 * Mirrors the production semantics of getActiveMealPlanSchedule
 * (actions/meal-plan.ts): plans do not cycle, dayNumber is 1-based,
 * dates past `duration` are unplanned, latest startDate wins overlaps.
 *
 * Pure module — date math only, no I/O.
 *
 * @module lib/nutrients/schedule-window
 */

export interface ScheduleLike {
  id: string;
  startDate: Date;
  /** Template duration in days */
  duration: number;
}

export interface WindowDay {
  /** Local calendar date, YYYY-MM-DD */
  date: string;
  scheduleId: string | null;
  /** 1-based template dayNumber, null when no schedule covers the date */
  dayNumber: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function atLocalMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Whole local days from a to b; Math.round absorbs DST hour shifts. */
function daysBetween(a: Date, b: Date): number {
  return Math.round(
    (atLocalMidnight(b).getTime() - atLocalMidnight(a).getTime()) / DAY_MS
  );
}

export function resolveScheduleWindow(
  schedules: ScheduleLike[],
  today: Date,
  windowDays = 7
): WindowDay[] {
  const byLatestStart = [...schedules].sort(
    (a, b) => b.startDate.getTime() - a.startDate.getTime()
  );

  const window: WindowDay[] = [];
  const start = atLocalMidnight(today);

  for (let i = 0; i < windowDays; i++) {
    const date = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + i
    );

    let resolved: WindowDay = {
      date: localDateKey(date),
      scheduleId: null,
      dayNumber: null,
    };
    for (const s of byLatestStart) {
      const diff = daysBetween(s.startDate, date);
      if (diff >= 0 && diff < s.duration) {
        resolved = {
          date: localDateKey(date),
          scheduleId: s.id,
          dayNumber: diff + 1,
        };
        break;
      }
    }
    window.push(resolved);
  }

  return window;
}
