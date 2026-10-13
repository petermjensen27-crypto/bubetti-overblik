import { describe, expect, it } from "vitest";
import { blendForecastProjection } from "./forecast";

describe("blendForecastProjection", () => {
  it("weights observed month pace more than historical growth", () => {
    const forecast = blendForecastProjection(220_000, 11, 31, 500_000, {
      mid: 1.45,
      lo: 1.1,
      hi: 1.8,
    });

    expect(forecast.mtd).toBe(220_000);
    expect(forecast.mid).toBeCloseTo(731653.23, 2);
    expect(forecast.lo).toBeCloseTo(671532.26, 2);
    expect(forecast.hi).toBeCloseTo(791774.19, 2);
    expect(forecast.growthMid).toBe(1.45);
  });

  it("does not project additional sales after the last day of the month", () => {
    const forecast = blendForecastProjection(220_000, 31, 31, 500_000, {
      mid: 1.45,
      lo: 1.1,
      hi: 1.8,
    });

    expect(forecast.mid).toBe(220_000);
  });

  it("keeps the interval ordered when historical remainder is negative", () => {
    const forecast = blendForecastProjection(100, 10, 20, -50, {
      mid: 1.5,
      lo: 1,
      hi: 2,
    });

    expect(forecast.lo).toBe(140);
    expect(forecast.hi).toBe(155);
  });
});