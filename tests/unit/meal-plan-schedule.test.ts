import { describe, expect, it } from "vitest";
import { canScheduleOn, overlapsSchedule } from "@/lib/meal-plan-schedule";

// Local-time dates (month is 0-based), matching how the calendar builds cells.
const day = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m, d, h, min);

describe("canScheduleOn", () => {
  const today = day(2026, 8, 29, 14, 30);

  it("allows today, even when `today` carries a time of day", () => {
    expect(canScheduleOn(day(2026, 8, 29), today)).toBe(true);
    expect(canScheduleOn(day(2026, 8, 29, 23, 59), today)).toBe(true);
  });

  it("allows future days, including ones outside the visible month", () => {
    expect(canScheduleOn(day(2026, 8, 30), today)).toBe(true);
    expect(canScheduleOn(day(2026, 9, 3), today)).toBe(true);
    expect(canScheduleOn(day(2027, 0, 1), today)).toBe(true);
  });

  it("rejects past days", () => {
    expect(canScheduleOn(day(2026, 8, 28), today)).toBe(false);
    expect(canScheduleOn(day(2026, 8, 28, 23, 59), today)).toBe(false);
    expect(canScheduleOn(day(2025, 11, 31), today)).toBe(false);
  });
});

describe("overlapsSchedule", () => {
  // Existing 3-day schedule: Oct 10, 11, 12.
  const existing = [{ startDate: day(2026, 9, 10), duration: 3 }];

  it("is false when there are no schedules", () => {
    expect(overlapsSchedule(day(2026, 9, 10), 7, [])).toBe(false);
  });

  it("is false for ranges that end before or start after an existing schedule", () => {
    expect(overlapsSchedule(day(2026, 9, 7), 3, existing)).toBe(false); // Oct 7-9
    expect(overlapsSchedule(day(2026, 9, 13), 5, existing)).toBe(false); // Oct 13-17
  });

  it("detects a start inside an existing schedule", () => {
    expect(overlapsSchedule(day(2026, 9, 12), 2, existing)).toBe(true);
  });

  it("detects an end inside an existing schedule", () => {
    expect(overlapsSchedule(day(2026, 9, 8), 3, existing)).toBe(true); // Oct 8-10
  });

  it("detects a range that fully covers an existing schedule", () => {
    expect(overlapsSchedule(day(2026, 9, 9), 7, existing)).toBe(true);
  });

  it("treats a one-day plan as occupying only its start day", () => {
    expect(overlapsSchedule(day(2026, 9, 13), 1, existing)).toBe(false);
    expect(overlapsSchedule(day(2026, 9, 11), 1, existing)).toBe(true);
  });
});
