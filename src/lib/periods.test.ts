import { describe, expect, it } from "vitest";
import { daysInMonth, dueSnapshot, periodBounds } from "./periods";
import { periodsBetween } from "./ingest";

describe("periodBounds", () => {
  it("half month is the 1st–15th", () => {
    expect(periodBounds({ year: 2026, month: 6, split: "half" })).toEqual({
      start: "2026-06-01",
      end: "2026-06-15",
    });
  });

  it("full month ends on the last day (with leap year)", () => {
    expect(periodBounds({ year: 2024, month: 2, split: "full" }).end).toBe("2024-02-29");
    expect(periodBounds({ year: 2025, month: 2, split: "full" }).end).toBe("2025-02-28");
    expect(periodBounds({ year: 2026, month: 4, split: "full" }).end).toBe("2026-04-30");
  });
});

describe("daysInMonth", () => {
  it("knows month lengths", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe("dueSnapshot", () => {
  it("returns the current half month on the 16th", () => {
    const d = dueSnapshot(new Date("2026-06-16T05:00:00Z"));
    expect(d).toEqual({ year: 2026, month: 6, split: "half" });
  });

  it("returns the previous full month on the 1st", () => {
    const d = dueSnapshot(new Date("2026-07-01T05:00:00Z"));
    expect(d).toEqual({ year: 2026, month: 6, split: "full" });
  });

  it("rolls the year over on Jan 1st", () => {
    const d = dueSnapshot(new Date("2026-01-01T05:00:00Z"));
    expect(d).toEqual({ year: 2025, month: 12, split: "full" });
  });

  it("returns null on other days", () => {
    expect(dueSnapshot(new Date("2026-06-10T05:00:00Z"))).toBeNull();
  });
});

describe("periodsBetween", () => {
  it("expands a range into half+full per month", () => {
    const keys = periodsBetween(
      { year: 2026, month: 5, split: "half" },
      { year: 2026, month: 6, split: "full" },
    );
    expect(keys).toEqual([
      { year: 2026, month: 5, split: "half" },
      { year: 2026, month: 5, split: "full" },
      { year: 2026, month: 6, split: "half" },
      { year: 2026, month: 6, split: "full" },
    ]);
  });

  it("stops at a half-month end without the trailing full month", () => {
    const keys = periodsBetween(
      { year: 2026, month: 6, split: "half" },
      { year: 2026, month: 6, split: "half" },
    );
    expect(keys).toEqual([{ year: 2026, month: 6, split: "half" }]);
  });
});
