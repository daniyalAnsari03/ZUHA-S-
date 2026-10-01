import { describe, expect, it } from "vitest";

import { easeOutSlide, slideDuration } from "@/lib/storefront/slide-motion";

describe("slideDuration", () => {
  it("returns zero when there is nowhere to go", () => {
    expect(slideDuration(0)).toBe(0);
  });

  it("treats direction as irrelevant", () => {
    expect(slideDuration(-900)).toBe(slideDuration(900));
  });

  it("stays inside its bounds for every plausible slide travel", () => {
    // A slide is 800-1000px on a phone or desktop; a dot jump can cross the
    // whole deck. Nothing may fall out of the readable range.
    for (const distance of [1, 100, 420, 800, 900, 1000, 5000, 90000]) {
      const duration = slideDuration(distance);
      expect(duration).toBeGreaterThanOrEqual(430);
      expect(duration).toBeLessThanOrEqual(980);
    }
  });

  it("grows with distance so a long jump is not a cut and a step is not a crawl", () => {
    expect(slideDuration(900)).toBeGreaterThan(slideDuration(200));
  });

  it("stays inside the window the browser QA harness fails on", () => {
    // tests/qa/slider-smoothness.mjs treats a glide that settles in under 300ms
    // as a cut and over 1100ms as unresponsive. No reachable travel may escape.
    for (const distance of [1, 100, 420, 800, 900, 1000, 5000, 90000]) {
      expect(slideDuration(distance)).toBeGreaterThanOrEqual(300);
      expect(slideDuration(distance)).toBeLessThanOrEqual(1100);
    }
  });

  it("gives a single slide step enough time to read as motion", () => {
    // A 900px slide. Below ~600ms the deck reads as a cut even when eased;
    // this is the number that has to move before smoothness regresses.
    expect(slideDuration(900)).toBeGreaterThanOrEqual(600);
  });
});

describe("easeOutSlide", () => {
  it("pins both ends", () => {
    expect(easeOutSlide(0)).toBe(0);
    expect(easeOutSlide(1)).toBe(1);
  });

  it("clamps outside the unit interval instead of overshooting", () => {
    expect(easeOutSlide(-0.5)).toBe(0);
    expect(easeOutSlide(1.5)).toBe(1);
  });

  it("stays monotonic, so the glide can never reverse", () => {
    let previous = -1;
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const value = easeOutSlide(t);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
      previous = value;
    }
  });

  it("lifts off instead of jumping off the deck", () => {
    // The whole point of the blend, stated as the number it was measured on: the
    // first animation frame of a 900px glide (642ms, so t = 16.7/642).
    const firstFrame = 16.7 / slideDuration(900);
    expect(easeOutSlide(firstFrame) * 900).toBeLessThan(65);

    // The pure ease-out this replaced put ~90px of the same slide into that
    // frame, and anything near that again is the abrupt launch coming back.
    expect((1 - (1 - firstFrame) ** 4) * 900).toBeGreaterThan(85);

    // And it is measurably gentler than the pure ease-out along the whole
    // curve, not just at the start.
    for (let t = 0.02; t < 0.98; t += 0.02) {
      expect(easeOutSlide(t)).toBeLessThan(1 - (1 - t) ** 4);
    }
  });

  it("still settles decisively rather than crawling into place", () => {
    // Three quarters of the way through the glide it is nearly there, and the
    // last quarter closes almost nothing — the shape that reads as an arrival.
    expect(easeOutSlide(0.75)).toBeGreaterThan(0.9);
    expect(easeOutSlide(0.95) - easeOutSlide(0.75)).toBeLessThan(0.08);

    // And it keeps its forward momentum: every 5% of time moves it further on.
    for (let t = 0.1; t < 0.95; t += 0.05) {
      expect(easeOutSlide(t + 0.05)).toBeGreaterThan(easeOutSlide(t));
    }
  });
});
