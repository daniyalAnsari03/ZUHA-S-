import { describe, expect, it } from "vitest";

import {
  easeOutSlide,
  slideDuration,
  swipeAxis,
  swipeCommitDistance,
  swipeCommits,
} from "@/lib/storefront/slide-motion";

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

describe("swipeCommitDistance", () => {
  it("scales with the slide above the floor, so the same flick reads the same on any screen", () => {
    // The deck is one viewport tall. Above the floor a phone in landscape
    // (a short slide) commits earlier than a phone held upright (a tall one),
    // because a tenth of a 500px slide is a shorter, easier push than a tenth of
    // a 1000px one — and a fixed number would be a nudge on one and a flick on
    // the other.
    expect(swipeCommitDistance(568)).toBeCloseTo(56.8, 5);
    expect(swipeCommitDistance(844)).toBeCloseTo(84.4, 5);
    expect(swipeCommitDistance(1200)).toBeCloseTo(120, 5);
  });

  it("never drops below the absolute floor, however short the viewport", () => {
    // A phone in landscape can present a 320px slide, where a tenth of it would
    // be 32px — less than a thumb's drift, and less than the gap between two
    // dots on the rail the shopper is using as their other control.
    expect(swipeCommitDistance(320)).toBe(40);
    expect(swipeCommitDistance(400)).toBe(40);
    expect(swipeCommitDistance(50)).toBe(40);
  });

  it("is above the drift a resting thumb produces", () => {
    // Ten pixels of noise on a hand at rest must never be read as intent, and it
    // must not sit close enough to the threshold to be luck either.
    for (const slide of [320, 400, 568, 844, 900, 1200]) {
      expect(swipeCommitDistance(slide)).toBeGreaterThanOrEqual(40);
    }
    expect(swipeCommitDistance(900)).toBeGreaterThanOrEqual(80);
  });
});

describe("swipeCommits", () => {
  it("ignores direction", () => {
    expect(swipeCommits(-200, 900)).toBe(swipeCommits(200, 900));
  });

  it("is inclusive at the threshold, so there is no gap where a swipe is neither", () => {
    const commit = swipeCommitDistance(900);
    expect(swipeCommits(commit, 900)).toBe(true);
    expect(swipeCommits(commit - 1, 900)).toBe(false);
  });

  it("reads a tap and a shift as neither, and a flick as a swipe", () => {
    // A tap is 0px, thumb drift is a handful of pixels, and the shortest thing
    // anybody means by a swipe is a tenth of a slide.
    expect(swipeCommits(0, 900)).toBe(false);
    expect(swipeCommits(8, 900)).toBe(false);
    expect(swipeCommits(39, 900)).toBe(false);
    expect(swipeCommits(120, 900)).toBe(true);
  });

  it("commits a whole-slide throw and a four-slide throw alike, because the cap is elsewhere", () => {
    // The distance decides only WHETHER it is a swipe. How far the deck then
    // travels is the component's bound of one slide, so no distance here can
    // move the deck by more than one — which is why this predicate is allowed to
    // keep answering "yes" forever.
    expect(swipeCommits(900, 900)).toBe(true);
    expect(swipeCommits(3600, 900)).toBe(true);
    expect(swipeCommits(90000, 900)).toBe(true);
  });

  it("holds across every slide height a phone or desktop can present", () => {
    for (const slide of [320, 400, 568, 667, 738, 800, 844, 900, 1000, 1200]) {
      const commit = swipeCommitDistance(slide);
      expect(commit).toBeGreaterThan(0);
      expect(swipeCommits(commit, slide)).toBe(true);
      expect(swipeCommits(commit - 1, slide)).toBe(false);
      expect(swipeCommits(0, slide)).toBe(false);
    }
  });
});

describe("swipeAxis", () => {
  it("waits rather than guessing while the finger has barely moved", () => {
    // A moving hand produces several pixels of noise before a real drag starts.
    // Claiming the gesture there would take sideways drags away from whoever
    // else wanted them, and the cost of waiting 10px is unmeasurable.
    expect(swipeAxis(0, 0)).toBe("undecided");
    expect(swipeAxis(3, -9)).toBe("undecided");
    expect(swipeAxis(-9, -3)).toBe("undecided");
  });

  it("claims a vertical drag for the deck", () => {
    expect(swipeAxis(0, -200)).toBe("vertical");
    expect(swipeAxis(0, 200)).toBe("vertical");
    expect(swipeAxis(40, -200)).toBe("vertical");
  });

  it("claims a sideways drag for nobody, because the deck has no sideways travel", () => {
    expect(swipeAxis(200, 0)).toBe("horizontal");
    expect(swipeAxis(200, -40)).toBe("horizontal");
    expect(swipeAxis(-200, 40)).toBe("horizontal");
  });

  it("gives a diagonal to the deck only when vertical genuinely wins", () => {
    // 45 degrees is a tie, and a tie on a full-bleed cover is somebody
    // adjusting their grip rather than swiping.
    expect(swipeAxis(100, -100)).toBe("vertical");
    expect(swipeAxis(100, -101)).toBe("vertical");
    expect(swipeAxis(101, -100)).toBe("horizontal");
  });
});