import { describe, it, expect } from "vitest";
import {
  resolveScheduleWindow,
  type ScheduleLike,
} from "@/lib/nutrients/schedule-window";

// Local-noon constructor avoids UTC-midnight rollover in any timezone.
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 12);

const schedule = (over: Partial<ScheduleLike> = {}): ScheduleLike => ({
  id: "s1",
  startDate: d(2026, 6, 8), // Monday
  duration: 7,
  ...over,
});

describe("resolveScheduleWindow", () => {
  it("maps the next 7 days to 1-based template dayNumbers", () => {
    const win = resolveScheduleWindow([schedule()], d(2026, 6, 10));
    expect(win).toHaveLength(7);
    expect(win[0]).toEqual({ date: "2026-06-10", scheduleId: "s1", dayNumber: 3 });
    expect(win[4]).toEqual({ date: "2026-06-14", scheduleId: "s1", dayNumber: 7 });
  });

  it("marks days past the plan duration as unplanned", () => {
    const win = resolveScheduleWindow([schedule()], d(2026, 6, 10));
    // 2026-06-15 is day 8 of a 7-day plan
    expect(win[5]).toEqual({ date: "2026-06-15", scheduleId: null, dayNumber: null });
    expect(win[6].dayNumber).toBeNull();
  });

  it("marks days before the schedule start as unplanned", () => {
    const win = resolveScheduleWindow(
      [schedule({ startDate: d(2026, 6, 12) })],
      d(2026, 6, 10)
    );
    expect(win[0].dayNumber).toBeNull(); // 06-10
    expect(win[1].dayNumber).toBeNull(); // 06-11
    expect(win[2]).toEqual({ date: "2026-06-12", scheduleId: "s1", dayNumber: 1 });
  });

  it("prefers the schedule with the latest startDate on overlap", () => {
    const win = resolveScheduleWindow(
      [
        schedule({ id: "old", startDate: d(2026, 6, 1), duration: 30 }),
        schedule({ id: "new", startDate: d(2026, 6, 9), duration: 7 }),
      ],
      d(2026, 6, 10)
    );
    expect(win[0]).toEqual({ date: "2026-06-10", scheduleId: "new", dayNumber: 2 });
  });

  it("returns all-unplanned when there are no schedules", () => {
    const win = resolveScheduleWindow([], d(2026, 6, 10));
    expect(win.every((w) => w.dayNumber === null && w.scheduleId === null)).toBe(true);
  });

  it("is robust across a month boundary", () => {
    const win = resolveScheduleWindow(
      [schedule({ startDate: d(2026, 6, 28), duration: 7 })],
      d(2026, 6, 29)
    );
    expect(win[2]).toEqual({ date: "2026-07-01", scheduleId: "s1", dayNumber: 4 });
  });
});
