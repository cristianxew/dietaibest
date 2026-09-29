// Pure date rules for scheduling meal plans on the calendar. Shared by the
// drag-and-drop path and the tap-to-schedule picker so both behave identically.

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** A plan can start today or any later day, never in the past. */
export function canScheduleOn(date: Date, today: Date): boolean {
  return startOfDay(date).getTime() >= startOfDay(today).getTime();
}

/** Whether a plan starting on `start` for `duration` days collides with any existing schedule. */
export function overlapsSchedule(
  start: Date,
  duration: number,
  schedules: ReadonlyArray<{ startDate: Date; duration: number }>
): boolean {
  const end = addDays(start, duration - 1);
  return schedules.some((s) => {
    const sEnd = addDays(s.startDate, s.duration - 1);
    return (
      (start >= s.startDate && start <= sEnd) ||
      (end >= s.startDate && end <= sEnd) ||
      (start <= s.startDate && end >= sEnd)
    );
  });
}
