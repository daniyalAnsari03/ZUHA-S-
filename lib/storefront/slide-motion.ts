/**
 * Motion maths for the homepage category slider.
 *
 * Split out from the component so the curve can be unit tested without a DOM,
 * a layout or a requestAnimationFrame. Everything here is pure: same input,
 * same output, no side effects.
 */

/**
 * How much of the glide is spent lifting off rather than settling down.
 *
 * A pure ease-out leaves at four times the average speed, so the very first
 * frame of a 642ms, 900px glide covers 90px of the slide. A native smooth
 * scroll moves ~20px in its first frame, so that is what read as a jump into
 * motion followed by a glide. A pure ease-in-out fixes the launch and creates
 * the opposite complaint: nothing visible happens for the first hundred
 * milliseconds and the input feels ignored. So the curve is a blend, weighted
 * towards the ease-out, and this is that weight — it brings the first frame
 * down to 59px without giving up any of the settle.
 */
const LIFT_OFF_WEIGHT = 0.35;

/**
 * The fixed part of every glide's duration, in milliseconds — what a glide costs
 * before it has covered a single pixel.
 */
const BASE_DURATION_MS = 430;

/**
 * How much of a millisecond a glide spends per pixel of travel, before the
 * bounds below clamp it. A one-slide step (800-1000px) comes to ~640ms, a
 * two-slide dot jump to ~850ms, and anything longer stops growing.
 */
const MS_PER_PIXEL = 0.235;

/** Longest glide the slider will ever run, in milliseconds. */
const MAX_DURATION_MS = 980;

/**
 * How long a glide between two offsets should take.
 *
 * A slide is 800-1000px tall, so the same duration cannot serve both a
 * one-slide step and a jump across half the deck: a fixed 700ms makes a single
 * step feel like it is crawling, a fixed 300ms makes a long jump feel like a
 * cut. Scaling with distance and clamping keeps a step brisk and a long jump
 * readable, and the upper bound stops a huge jump from turning into a long wait.
 *
 * The bounds also cover the machine: the QA harness (tests/qa/slider-smoothness.mjs)
 * fails a glide that settles outside 300-1100ms, so no reachable slide travel
 * can land outside it.
 */
export function slideDuration(distancePx: number): number {
  const distance = Math.abs(distancePx);
  if (distance === 0) return 0;
  return Math.min(MAX_DURATION_MS, BASE_DURATION_MS + distance * MS_PER_PIXEL);
}

/**
 * The glide curve: a smootherstep lift-off blended into a quartic settle.
 *
 * `smootherstep` leaves at zero velocity, so the slide lifts off the deck
 * instead of jumping off it — 59px of a 900px slide in the first frame where
 * the old pure ease-out covered 90px. The quartic ease-out is kept for the back
 * half, where it is what stops the deck crawling into place: it still covers
 * three quarters of the remaining distance in the last third of the time. Both
 * halves are monotonic and pinned to [0, 1] for t in [0, 1], so their blend is
 * too, which is what keeps the motion free of overshoot and reverse steps.
 */
export function easeOutSlide(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const inverse = 1 - t;
  const lift = t * t * (3 - 2 * t);
  const glide = 1 - inverse * inverse * inverse * inverse;
  return lift * LIFT_OFF_WEIGHT + glide * (1 - LIFT_OFF_WEIGHT);
}