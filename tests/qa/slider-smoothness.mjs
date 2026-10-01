/**
 * QA — homepage category slide stack (components/storefront/home-slides.tsx).
 *
 * Locks in the behaviour the deck is actually judged on, in a real browser: the
 * slides really do cover one another by being pinned rather than by being
 * animated, the wheel is travel rather than intent, and travel survives being
 * fractional — because a cover that can only rest on a boundary is a slideshow
 * again, which is the thing this build removed.
 *
 * WHAT THIS LOCKS IN
 *   1. IT IS STICKY, NOT SNAP. Every slide computes `position: sticky` at
 *      `top: 0`, one viewport tall, and the deck's scroll distance is exactly
 *      (N - 1) slides. That last number is the whole mechanism: a sticky child
 *      cannot be pushed above the bottom of its containing block, so the last
 *      slide arrives exactly as the deck runs out of room. If the distance were
 *      N slides there would be a screenful of dead travel past the footer, and
 *      if it were snap-typed a partial cover would be yanked back to a boundary.
 *   2. THE WHEEL IS TRAVEL. A notch moves the cover by roughly a notch and stops
 *      there — mid-slide, off any boundary — and nothing prevents the event. This
 *      is the assertion the old build was built to fail: it rested on exactly the
 *      next slide no matter how little was asked for.
 *   3. IT COVERS CONTINUOUSLY, AND UPSIDE DOWN. Scrolling to a fractional
 *      offset keeps that fractional offset, scrolling back retraces it, and
 *      neither direction reverses. This is what makes the effect read as one
 *      surface rather than as a queue of slides.
 *   4. THE FOOTER IS THE LAST SLIDE and the wheel is never trapped at the end.
 *   5. DOTS AND KEYS still glide, because those are destinations rather than
 *      travel. The trace is compared against `easeOutSlide` itself.
 *   6. ON A PHONE, A FINGER IS A DESTINATION TOO. Every swipe in [7] and [8]
 *      is a real touch gesture at four different speeds, in both directions,
 *      from every slide in the deck, and every one of them has to move exactly
 *      one slide and come to rest on it. This replaced the older rule that touch
 *      was travel as well; the reason it could not stay is in [7].
 *
 * HARNESS NOTES (learned the hard way here; do not "simplify" these away)
 *   - A POSITIVE yDistance in Input.synthesizeScrollGesture scrolls the viewport
 *     UP in this Chrome build. Forward, to the next slide, is NEGATIVE. This is
 *     verified by the control in [0]; if the control disagrees with the rest of
 *     the suite, trust the control.
 *   - gestureSourceType "touch" is inert in this headless setup: it moves
 *     neither the slide stack nor the document, so a touch test written with it
 *     passes or fails for reasons that have nothing to do with the site. "default"
 *     is the source that actually drives the scroll, and it is what [8] used to
 *     use.
 *   - Dispatched touch events do not scroll this container natively in this
 *     build — a 300px `Input.dispatchTouchEvent` drag fires zero `scroll` events
 *     (measured). That is not a limitation of the suite any more: the deck now
 *     drives its own scrolling from `touchmove`, so the gesture is measured
 *     through the very path a device exercises, and it would be wrong to test
 *     this any other way. `gestureSourceType: "default"` is still how the WHEEL
 *     path is driven on desktop.
 *   - Scrolling is sampled per animation frame. The stack is read here and
 *     asserted on where it RESTS; frame timing is only asserted for paths the
 *     page animates itself (the glide), never for browser-composited scrolls,
 *     which a main-thread sampler cannot see.
 *   - `offsetTop` is useless for finding a slide in this deck. Every slide is
 *     pinned, so its geometry reports wherever the deck currently is. Positions
 *     come from index x clientHeight instead, which is the deck's own model.
 *
 * Usage: node tests/qa/slider-smoothness.mjs
 */
import { launchChrome, openPage } from "./lib/cdp.mjs";
import { sleep, APP_URL, QaResults } from "./lib/harness.mjs";
// The real curve, imported from the app rather than restated here, so this file
// cannot pass against a curve the site does not actually use. Node strips the
// types off a .ts module itself; the file is erasable syntax on purpose.
import { easeOutSlide, slideDuration } from "../../lib/storefront/slide-motion.ts";

const PORT = 9352;
const BASE = APP_URL || "http://127.0.0.1:3000";
const SELECTOR = 'section[aria-label="Featured"] > div';

/** Longest frame gap tolerated inside a glide before it counts as a stall. */
const STALL_MS = 150;
/**
 * A glide has to be caught mid-flight to count as an animation, and that test
 * is deliberately frame-rate independent: a starved sampler can watch a real
 * 500ms glide and catch only its first and last frame. So this asks for a
 * sample strictly inside the travel, not for a count of frames.
 */
const MIN_INTERIOR_SAMPLES = 1;
const MIN_GLIDE_MS = 300;
const MAX_GLIDE_MS = 1100;
/** Matches MIN in tests/qa/tap-targets.mjs. */
const MIN_TAP_TARGET_PX = 44;
/**
 * How close a rest position has to be to a slide boundary to count AS one. A
 * gesture is measured in whole pixels and the compositor rounds scroll offsets to
 * device pixels, so exact equality against a multiple is never asserted; being
 * within a few pixels of one is a different and much stronger statement.
 */
const ON_BOUNDARY_PX = 3;

const results = new QaResults();

/**
 * Begin per-frame sampling of the stack, and report the container's own facts.
 *
 * The generation guard matters: a sampler started earlier in the run is still
 * looping, and without it those stale frames land in the new array carrying
 * their own (much larger) timestamps, which reads as a 3-second stall that
 * never happened.
 */
const START_SAMPLE = `
  const s = document.querySelector(${JSON.stringify(SELECTOR)});
  window.__gen = (window.__gen || 0) + 1;
  const gen = window.__gen;
  window.__s = [];
  const t0 = performance.now();
  window.__block = null;
  s.addEventListener("wheel", (e) => { window.__block = e.defaultPrevented; }, false);
  const tick = () => {
    if (gen !== window.__gen) return;
    window.__s.push([Math.round(performance.now() - t0), Math.round(s.scrollTop), Math.round(window.scrollY)]);
    if (performance.now() - t0 < 4000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return {
    clientHeight: s.clientHeight,
    scrollHeight: s.scrollHeight,
    slides: s.children.length,
    scrollBehavior: getComputedStyle(s).scrollBehavior,
    snapType: getComputedStyle(s).scrollSnapType,
  };
`;

const READ_SAMPLE = `return window.__s || [];`;

/**
 * How fast this machine actually delivers frames while the page is idle. Any
 * stall measured inside a glide is only meaningful against this: a dev server
 * compiling a route on first paint can starve every sampler on the page, and
 * blaming the slider for that would be measuring the wrong thing.
 */
const IDLE_FRAMES = `
  return await new Promise((resolve) => {
    const gaps = [];
    let previous = performance.now();
    const tick = () => {
      const now = performance.now();
      gaps.push(now - previous);
      previous = now;
      if (gaps.length < 40) requestAnimationFrame(tick);
      else resolve({ max: Math.max(...gaps), median: gaps.sort((a, b) => a - b)[20] });
    };
    requestAnimationFrame(tick);
  });
`;

const RESET = `
  const s = document.querySelector(${JSON.stringify(SELECTOR)});
  s.scrollTo({ top: 0, behavior: "instant" });
  window.scrollTo({ top: 0, behavior: "instant" });
  return true;
`;

/**
 * Let the images the stack is about to show finish decoding.
 *
 * The first glide after load lands while a full-bleed slide photograph is still
 * being fetched, decoded and rasterised, which starves the main thread for
 * reasons that have nothing to do with the deck. Measuring a cold glide and
 * calling it jank would be measuring the network.
 */
const SETTLE_IMAGES = `
  const imgs = [...document.querySelectorAll(${JSON.stringify(SELECTOR)}) + " img"];
  await Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())));
  return imgs.length;
`;

/** A single real mouse notch: the browser's own wheel event, not a synthesised scroll. */
async function notch(page, { deltaY = 100, x = 720, y = 450 } = {}) {
  await page.send("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x,
    y,
    deltaX: 0,
    deltaY,
    pointerType: "mouse",
  });
}

/**
 * A forward (negative) or backward (positive) scroll of `distance` pixels,
 * sampled from the start so the trace can be analysed.
 */
async function gesture(page, { distance, x = 720, y = 450, sample = true, settle = 1800 }) {
  if (sample) await page.eval(START_SAMPLE);
  await page.send("Input.synthesizeScrollGesture", {
    x,
    y,
    xDistance: 0,
    yDistance: distance,
    gestureSourceType: "mouse",
    speed: Math.max(400, Math.abs(distance) * 2),
    preventFling: true,
  });
  await sleep(settle);
  return sample ? await page.eval(READ_SAMPLE) : [];
}

function analyse(samples, from = 0, to = 0) {
  const [t0] = samples[0] || [0, 0, 0];
  const last = samples[samples.length - 1] || [0, 0, 0];

  let settleMs = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i][1] !== samples[i - 1][1]) settleMs = samples[i][0] - t0;
  }

  // Only the part of the trace where the stack was actually moving.
  const moving = samples.filter((s) => s[0] <= settleMs);
  const steps = [];
  let reversals = 0;
  for (let i = 1; i < moving.length; i++) {
    const d = moving[i][1] - moving[i - 1][1];
    if (d === 0) continue;
    steps.push(d);
    if (steps.length > 1 && Math.sign(d) !== Math.sign(steps[0])) reversals++;
  }

  const gaps = [];
  for (let i = 1; i < moving.length; i++) gaps.push(moving[i][0] - moving[i - 1][0]);

  // Samples caught strictly between the two ends of the travel: proof the
  // stack was observed in motion, whatever the frame rate did.
  const span = to - from;
  const interior = span
    ? moving.filter((s) => {
        const t = (s[1] - from) / span;
        return t > 0.1 && t < 0.9;
      }).length
    : 0;

  return {
    rest: last[1],
    pageY: last[2],
    peak: Math.max(...samples.map((s) => s[1])),
    settleMs,
    distinctPositions: new Set(moving.map((s) => s[1])).size,
    movingFrames: steps.length,
    interior,
    maxGapMs: gaps.length ? Math.max(...gaps) : 0,
    reversals,
    samples: moving,
  };
}

/** Distance from `rest` to the nearest multiple of `unit`, i.e. how far off a boundary it is. */
function offBoundary(rest, unit) {
  if (!unit) return Infinity;
  return Math.abs(rest - Math.round(rest / unit) * unit);
}

/**
 * How much of the observed settle tracks `easeOutSlide`, as a 0..1 fraction of
 * sampled frames.
 *
 * Both a compositor snap and an eased glide arrive at the same place, so "it
 * landed where it was asked to" cannot tell them apart. What can is the SHAPE:
 * for each frame, where the offset was, against where `easeOutSlide` says it
 * should be at the same point in the glide. A snap moves at its own pace and
 * drifts off the curve; a glide drawn from that curve does not.
 *
 * The tolerance is not a constant, because this machine does not deliver a frame
 * every 16ms — the desktop traces show gaps far wider than a 60fps budget. Two
 * things follow, and both have to be allowed for:
 *
 *   the glide writes `scrollTop` and this sampler reads it inside the same
 *   requestAnimationFrame batch, so the sampler can see the PREVIOUS frame's
 *   offset — one sample of lag;
 *
 *   and the curve is steepest at the start, so a late sample lands further from
 *   it than one taken mid-glide.
 *
 * So each frame is allowed the easing it covers over its own gap, and a frame's
 * agreement is read against that rather than against a fixed epsilon. A linear
 * tween still misses by more than its gap allows; a glide does not.
 */
function curveTrace(samples, from, to) {
  const span = to - from;
  if (!span || !samples || samples.length < 4) return null;

  const clamp01 = (n) => Math.max(0, Math.min(1, n));
  const startIdx = samples.findIndex((s, i) => i > 0 && s[1] !== samples[i - 1][1]);
  if (startIdx <= 0) return null;

  // Align on the last frame before the glide wrote anything, and allow one
  // further frame of lag.
  const startAt = samples[startIdx - 1][0] - (samples[startIdx][0] - samples[startIdx - 1][0]);
  const duration = slideDuration(span);

  const rows = [];
  for (let i = startIdx - 1; i < samples.length; i++) {
    const at = samples[i][0];
    const gap = i + 1 < samples.length ? samples[i + 1][0] - at : 0;
    const t = clamp01((at - startAt) / duration);
    const observed = (samples[i][1] - from) / span;
    const expected = easeOutSlide(t);
    const allowed = easeOutSlide(clamp01((at + 2 * gap - startAt) / duration)) - expected;
    rows.push({
      t: at,
      gap,
      observed,
      expected,
      tolerance: Math.max(0.05, Math.abs(allowed) * 1.5),
      error: Math.abs(observed - expected),
    });
  }

  return {
    rows,
    duration,
    onCurve: rows.filter((r) => r.error <= r.tolerance).length,
    medianGap: median(rows.map((r) => r.gap).filter(Boolean)),
  };
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function curveAgreement(samples, from, to) {
  const trace = curveTrace(samples, from, to);
  if (!trace) return 0;
  return trace.onCurve / trace.rows.length;
}

function curveReport(samples, from, to) {
  const trace = curveTrace(samples, from, to);
  if (!trace) return "no usable trace to compare against the curve";
  const share = Math.round((trace.onCurve / trace.rows.length) * 100);
  const sample = trace.rows
    .filter((_, i) => i % Math.max(1, Math.floor(trace.rows.length / 4)) === 0)
    .slice(0, 4)
    .map(
      (r) =>
        `${r.t}ms ${(r.observed * 100).toFixed(0)}% ` +
        `(curve ${(r.expected * 100).toFixed(0)}% +/-${(r.tolerance * 100).toFixed(0)}%)`,
    )
    .join(", ");
  return (
    `${share}% of frames track easeOutSlide over a ${Math.round(trace.duration)}ms glide ` +
    `(sampled every ~${Math.round(trace.medianGap)}ms, so one frame of lag is allowed); ${sample}`
  );
}

function note(a) {
  return `rest=${a.rest} peak=${a.peak} settle=${a.settleMs}ms frames=${a.movingFrames} ` +
    `positions=${a.distinctPositions} interior=${a.interior} maxGap=${a.maxGapMs}ms ` +
    `reversals=${a.reversals} pageY=${a.pageY}`;
}

/** Read the deck's geometry and where every slide actually sits, at a given index. */
const STACK_STATE = `
  const s = document.querySelector(${JSON.stringify(SELECTOR)});
  const index = async (i) => {
    s.scrollTo({ top: i * s.clientHeight, behavior: "instant" });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  };
  await index(window.__probeIndex);
  const sr = s.getBoundingClientRect();
  const slides = [...s.children].map((el, i) => {
    const r = el.getBoundingClientRect();
    return {
      i,
      position: getComputedStyle(el).position,
      top: getComputedStyle(el).top,
      snapAlign: getComputedStyle(el).scrollSnapAlign,
      height: Math.round(r.height),
      offsetFromTop: Math.round(sr.top - r.top),
      kind: el.dataset.slide || "slide",
    };
  });
  return {
    clientHeight: s.clientHeight,
    scrollHeight: s.scrollHeight,
    maxScroll: s.scrollHeight - s.clientHeight,
    snapType: getComputedStyle(s).scrollSnapType,
    scrollBehavior: getComputedStyle(s).scrollBehavior,
    overscroll: getComputedStyle(s).overscrollBehaviorY,
    scrollTop: Math.round(s.scrollTop),
    slides,
  };
`;

const chrome = await launchChrome({ port: PORT, headless: true });
let failed = false;

try {
  /* ── Desktop ─────────────────────────────────────────────────────────── */

  const page = await openPage(PORT, { width: 1440, height: 900 });
  await page.goto(`${BASE}/`, { waitMs: 1500 });

  const info = await page.eval(START_SAMPLE);
  const slide = info.clientHeight;

  // Baseline first, while the page is untouched, so the stall budget below is
  // measured against this machine rather than against an assumed 60fps.
  const idle = await page.eval(IDLE_FRAMES);
  const stallBudget = Math.max(STALL_MS, Math.round(idle.max * 1.5));

  console.log(`\nStack: ${info.slides} slides, one slide = ${slide}px, ` +
    `scroll-behavior=${info.scrollBehavior}, scroll-snap-type=${info.snapType}`);
  console.log(`Idle frame cadence on this machine: median ${Math.round(idle.median)}ms, ` +
    `worst ${Math.round(idle.max)}ms -> stall budget ${stallBudget}ms\n`);

  // [0] Control: the direction convention the rest of this file depends on.
  await page.eval(RESET);
  await sleep(400);
  await page.send("Input.synthesizeScrollGesture", {
    x: 720,
    y: 450,
    xDistance: 0,
    yDistance: -slide,
    gestureSourceType: "mouse",
    speed: slide,
    preventFling: true,
  });
  await sleep(1400);
  const control = await page.eval(`
    const s = document.querySelector(${JSON.stringify(SELECTOR)});
    return { stack: Math.round(s.scrollTop), page: Math.round(window.scrollY) };
  `);
  results.record(
    "harness-direction",
    "control: a forward gesture advances the stack, so 'forward' is negative yDistance",
    control.stack >= slide,
    {
      note: `stack=${control.stack} page=${control.page}`,
      mismatch: control.stack >= slide ? undefined : `stack=${control.stack}, expected >= ${slide}`,
    },
  );
  if (control.stack < slide) {
    console.log("  Direction convention unproven — the remaining assertions are meaningless. Stopping.");
    throw new Error("direction control failed");
  }

  /* ── [1] The mechanism: sticky, unpinned by nothing, one slide less of room */

  const stack = await page.eval(`window.__probeIndex = 3; ${STACK_STATE}`);
  const pinned = stack.slides.filter((s) => s.offsetFromTop === 0);
  const unpinned = stack.slides.filter((s) => s.offsetFromTop !== 0);

  console.log(
    `  At slide 3: ${pinned.length} slides pinned, ` +
      `travel = ${stack.maxScroll}px of ${slide}px slides\n`,
  );

  results.record(
    "slides-are-sticky-pinned-to-the-top",
    "every slide is position:sticky at top:0 and one viewport tall",
    stack.slides.every(
      (s) => s.position === "sticky" && s.top === "0px" && s.height === slide,
    ),
    {
      note: stack.slides.map((s) => `${s.position}/${s.top}/${s.height}px`).join(" "),
      mismatch: stack.slides
        .filter((s) => s.position !== "sticky" || s.top !== "0px" || s.height !== slide)
        .map((s) => `slide ${s.i + 1}: ${s.position} top:${s.top} height:${s.height}px`)
        .join("; "),
    },
  );
  if (!stack.slides.every((s) => s.position === "sticky" && s.top === "0px" && s.height === slide)) {
    failed = true;
  }

  results.record(
    "stack-has-one-slide-less-of-travel-than-slides",
    "scroll distance is (N - 1) slides, so the last slide lands exactly as the deck runs out",
    stack.maxScroll === (info.slides - 1) * slide,
    {
      note: `${info.slides} slides, travel=${stack.maxScroll}px, expected ${(info.slides - 1) * slide}px`,
      mismatch:
        stack.maxScroll === (info.slides - 1) * slide
          ? undefined
          : `travel=${stack.maxScroll}px, expected ${(info.slides - 1) * slide}px for ${info.slides} slides`,
    },
  );
  if (stack.maxScroll !== (info.slides - 1) * slide) failed = true;

  results.record(
    "covering-slides-are-pinned",
    "at any slide index that slide and every one above it are pinned to the top of the scrollport",
    stack.scrollTop === 3 * slide && pinned.length === 4 && pinned[3]?.i === 3,
    {
      note: `at ${stack.scrollTop}px: pinned slides are [${pinned.map((s) => s.i + 1).join(", ")}], ` +
        `stacked below are [${unpinned.map((s) => s.i + 1).join(", ")}]`,
      mismatch:
        stack.scrollTop !== 3 * slide
          ? `the deck did not rest at 3 slides (${stack.scrollTop}px)`
          : pinned.length !== 4
            ? `expected 4 pinned slides, got ${pinned.length}`
            : pinned[3]?.i !== 3
              ? `slide ${(pinned[3]?.i ?? 0) + 1} is on top at scroll index 3, not slide 4`
              : undefined,
    },
  );
  if (stack.scrollTop !== 3 * slide || pinned.length !== 4 || pinned[3]?.i !== 3) failed = true;

  results.record(
    "no-snap-anywhere-in-the-deck",
    "neither the deck nor any slide declares a snap point",
    stack.snapType === "none" &&
      stack.slides.every((s) => s.snapAlign === "none") &&
      info.snapType === "none",
    {
      note: `scroller snap-type=${stack.snapType}, snap-align per slide: ` +
        `${stack.slides.map((s) => s.snapAlign).join(", ")}`,
      mismatch:
        stack.snapType !== "none"
          ? `the deck declares scroll-snap-type: ${stack.snapType} — a partial cover would be yanked to a boundary`
          : stack.slides.find((s) => s.snapAlign !== "none")
            ? `slide ${stack.slides.find((s) => s.snapAlign !== "none").i + 1} declares scroll-snap-align: ` +
              `${stack.slides.find((s) => s.snapAlign !== "none").snapAlign}`
            : undefined,
    },
  );
  if (stack.snapType !== "none" || stack.slides.some((s) => s.snapAlign !== "none")) {
    failed = true;
  }

  /* ── [2] The wheel is travel, not intent */

  // The first notch of the run is a warm-up and is reported but not asserted: it
  // fires while the first slide photograph is still arriving, and the point of
  // this check is how the deck behaves in steady use, not how the network
  // behaved on a cold page.
  await page.eval(RESET);
  await page.eval(SETTLE_IMAGES);
  await sleep(500);
  await page.eval(START_SAMPLE);
  await notch(page);
  await sleep(1600);
  const warmup = analyse(await page.eval(READ_SAMPLE), 0, slide);

  await page.eval(RESET);
  await page.eval(SETTLE_IMAGES);
  await sleep(500);
  await page.eval(START_SAMPLE);
  await notch(page);
  await sleep(1600);
  let a = analyse(await page.eval(READ_SAMPLE), 0, slide);
  const blocked = await page.eval(`return window.__block;`);

  console.log(`  [warm-up notch, not asserted] ${note(warmup)}\n`);

  results.record(
    "notch-is-not-a-slide-jump",
    "one mouse notch moves the cover by about a notch, not to the next slide",
    a.rest > 0 && a.peak < slide && offBoundary(a.rest, slide) > ON_BOUNDARY_PX,
    {
      note: `${note(a)}; ${offBoundary(a.rest, slide).toFixed(0)}px off the nearest slide boundary`,
      mismatch:
        a.rest <= 0
          ? "the notch did not move the deck at all"
          : a.peak >= slide
            ? `the deck crossed a whole slide (peak ${a.peak}px) on a single notch — the wheel is being read as intent`
            : offBoundary(a.rest, slide) <= ON_BOUNDARY_PX
              ? `rested at ${a.rest}px, on a slide boundary (${slide}px) — something is still snapping`
              : undefined,
    },
  );
  if (a.rest <= 0 || a.peak >= slide || offBoundary(a.rest, slide) <= ON_BOUNDARY_PX) {
    failed = true;
  }

  results.record(
    "notch-is-never-prevented",
    "the deck takes no wheel event for itself",
    blocked !== true,
    {
      note: `wheel defaultPrevented=${blocked}`,
      mismatch: blocked === true ? "a wheel event was preventDefault'd" : undefined,
    },
  );
  if (blocked === true) failed = true;

  results.record(
    "notch-does-not-spring-back",
    "the cover moves one way under a push and never reverses",
    a.reversals === 0 && a.maxGapMs <= stallBudget,
    {
      note: note(a),
      mismatch:
        a.reversals > 0
          ? `${a.reversals} reverse steps in one push — the deck is springing back`
          : a.maxGapMs > stallBudget
            ? `${a.maxGapMs}ms frame gap, over the ${stallBudget}ms budget`
            : undefined,
    },
  );
  if (a.reversals > 0 || a.maxGapMs > stallBudget) failed = true;

  /* ── [3] It covers continuously, and upside down */

  // Halfway through a cover, halfway through the SAME cover going back. If the
  // deck could only rest on boundaries, or if scrolling up ran a different rule
  // from scrolling down, these two would not be the same distance apart.
  // Two and a half slides down, then one and a bit back UP from exactly there. If
// the deck could only rest on boundaries, or if scrolling up ran a different rule
// from scrolling down, the second reading would not be the first one minus what
// was asked for. Note there is no reset between the two: the backward gesture has
// to start from where the forward one left the deck, which is the whole point.
await page.eval(RESET);
  await sleep(300);
  const down = analyse(await gesture(page, { distance: -slide * 2.5 }), 0, slide * 2.5);

  const parked = await page.eval(`
    const s = document.querySelector(${JSON.stringify(SELECTOR)});
    return Math.round(s.scrollTop);
  `);
  await gesture(page, { distance: slide * 1.3, sample: false });
  const back = await page.eval(`
    const s = document.querySelector(${JSON.stringify(SELECTOR)});
    return Math.round(s.scrollTop);
  `);

  results.record(
    "a-partial-cover-is-a-legal-resting-place",
    "scrolling to two and a half slides rests halfway through the third, not on a boundary",
    Math.abs(down.rest - slide * 2.5) <= slide * 0.15 &&
      offBoundary(down.rest, slide) > ON_BOUNDARY_PX,
    {
      note: `${note(down)}; ${offBoundary(down.rest, slide).toFixed(0)}px off the nearest boundary`,
      mismatch:
        Math.abs(down.rest - slide * 2.5) > slide * 0.15
          ? `asked for ${slide * 2.5}px, rested at ${down.rest}px`
          : offBoundary(down.rest, slide) <= ON_BOUNDARY_PX
            ? `rested at ${down.rest}px — exactly on a slide boundary`
            : undefined,
    },
  );
  if (Math.abs(down.rest - slide * 2.5) > slide * 0.15 || offBoundary(down.rest, slide) <= ON_BOUNDARY_PX) {
    failed = true;
  }

  results.record(
    "the-cover-travels-one-way-under-a-gesture",
    "a long push never reverses mid-flight",
    down.reversals === 0 && down.distinctPositions > 5,
    {
      note: note(down),
      mismatch:
        down.reversals > 0
          ? `${down.reversals} reverse steps while scrolling forward`
          : down.distinctPositions <= 5
            ? `only ${down.distinctPositions} distinct offsets across ${slide * 2.5}px of travel — that is a cut`
            : undefined,
    },
  );
  if (down.reversals > 0 || down.distinctPositions <= 5) failed = true;

  results.record(
    "scrolling-back-retraces-the-same-travel",
    "2.5 slides down then 1.3 back leaves 1.2 slides — the same rule both ways",
    Math.abs(back - (parked - slide * 1.3)) <= slide * 0.15 && back > 0,
    {
      note: `parked at ${parked}px, then 1.3 slides back -> ${back}px ` +
        `(expected ~${Math.round(parked - slide * 1.3)}px)`,
      mismatch:
        Math.abs(back - (parked - slide * 1.3)) > slide * 0.15
          ? `expected ~${Math.round(parked - slide * 1.3)}px, got ${back}px — the two directions disagree`
          : undefined,
    },
  );
  if (Math.abs(back - (parked - slide * 1.3)) > slide * 0.15 || back <= 0) failed = true;

  /* ── [4] The footer is the last slide, and the wheel is never trapped */

  await page.eval(RESET);
  await sleep(300);
  await gesture(page, { distance: -slide * (info.slides + 2), sample: false });
  const atEnd = await page.eval(`
    const s = document.querySelector(${JSON.stringify(SELECTOR)});
    window.__block = null;
    const sr = s.getBoundingClientRect();
    const last = s.children[s.children.length - 1];
    return {
      stack: Math.round(s.scrollTop),
      max: s.scrollHeight - s.clientHeight,
      page: Math.round(window.scrollY),
      lastKind: last.dataset.slide || "(none)",
      lastAtTop: Math.round(sr.top - last.getBoundingClientRect().top),
    };
  `);

  results.record(
    "the-last-slide-is-the-footer-and-it-lands-on-top",
    "scrolling to the end puts the footer exactly at the top of the scrollport",
    atEnd.stack === atEnd.max && atEnd.lastKind === "footer" && atEnd.lastAtTop === 0,
    {
      note: `stack=${atEnd.stack} max=${atEnd.max} page=${atEnd.page} ` +
        `last slide data-slide=${atEnd.lastKind}, ${atEnd.lastAtTop}px below the scrollport top`,
      mismatch:
        atEnd.stack !== atEnd.max
          ? `stack=${atEnd.stack}, expected max ${atEnd.max}`
          : atEnd.lastKind !== "footer"
            ? `the deck ends on data-slide=${atEnd.lastKind}, not the footer`
            : atEnd.lastAtTop !== 0
              ? `the footer rests ${atEnd.lastAtTop}px below the scrollport top`
              : undefined,
    },
  );
  if (atEnd.stack !== atEnd.max || atEnd.lastKind !== "footer" || atEnd.lastAtTop !== 0) {
    failed = true;
  }

  await page.send("Input.synthesizeScrollGesture", {
    x: 720,
    y: 450,
    xDistance: 0,
    yDistance: -600,
    gestureSourceType: "mouse",
    speed: 600,
    preventFling: true,
  });
  await sleep(1500);
  const chained = await page.eval(`
    const s = document.querySelector(${JSON.stringify(SELECTOR)});
    return { stack: Math.round(s.scrollTop), page: Math.round(window.scrollY), blocked: window.__block };
  `);
  results.record(
    "no-scroll-trap-at-the-end",
    "past the last slide the wheel is left to the browser, not swallowed",
    chained.blocked !== true,
    {
      note: `stack=${chained.stack} page=${chained.page} wheelPrevented=${chained.blocked}`,
      mismatch:
        chained.blocked === true
          ? "the wheel was preventDefault'd on the last slide — the deck is a scroll trap"
          : undefined,
    },
  );
  if (chained.blocked === true) failed = true;

  /* ── [5] Dots still glide: they are destinations, not travel */

  await page.eval(RESET);
  await sleep(500);
  const dotBox = await page.eval(`
    const dots = document.querySelectorAll('section[aria-label="Featured"] button[aria-label^="Go to slide"]');
    const target = dots[2];
    const r = target.getBoundingClientRect();
    return { count: dots.length, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  `);
  await page.eval(START_SAMPLE);
  await page.clickAt(dotBox.x, dotBox.y);
  await sleep(1600);
  a = analyse(await page.eval(READ_SAMPLE), 0, slide * 2);
  const dotCurrent = await page.eval(`
    const dots = [...document.querySelectorAll('section[aria-label="Featured"] button[aria-label^="Go to slide"]')];
    return dots.findIndex((d) => d.getAttribute("aria-current") === "true");
  `);

results.record(
    "dot-glides-to-the-slide-it-names",
    "a dot click glides to slide 3 and marks itself current",
    a.rest === slide * 2 &&
      a.interior >= MIN_INTERIOR_SAMPLES &&
      a.settleMs >= MIN_GLIDE_MS &&
      a.settleMs <= MAX_GLIDE_MS &&
      dotCurrent === 2,
    {
      note: `${dotBox.count} dots, ${dotBox.w}x${dotBox.h} target; ${note(a)}; current dot=${dotCurrent}`,
      mismatch:
        a.rest !== slide * 2
          ? `rested at ${a.rest}px, expected ${slide * 2}px`
          : a.interior < MIN_INTERIOR_SAMPLES
            ? "no frame caught mid-travel — a dot click must glide too"
            : a.settleMs < MIN_GLIDE_MS
              ? `settled in ${a.settleMs}ms — too fast to read as motion`
              : a.settleMs > MAX_GLIDE_MS
                ? `took ${a.settleMs}ms — too slow to feel responsive`
                : dotCurrent !== 2
                  ? `dot ${dotCurrent + 1} is current after landing on slide 3`
                  : undefined,
    },
  );
  if (
    a.rest !== slide * 2 ||
    a.interior < MIN_INTERIOR_SAMPLES ||
    a.settleMs < MIN_GLIDE_MS ||
    a.settleMs > MAX_GLIDE_MS ||
    dotCurrent !== 2
  ) {
    failed = true;
  }

  const dotCurve = curveAgreement(a.samples, 0, slide * 2);
  results.record(
    "dot-glide-follows-the-eased-curve",
    "the dot glide reproduces easeOutSlide rather than sliding at a constant rate",
    dotCurve >= 0.8,
    {
      note: curveReport(a.samples, 0, slide * 2),
      mismatch:
        dotCurve >= 0.8
          ? undefined
          : "the glide does not track easeOutSlide — it is moving by some other rule",
    },
  );
  if (dotCurve < 0.8) failed = true;

  results.record(
    "dot-target-is-big-enough",
    `each dot meets the ${MIN_TAP_TARGET_PX}px minimum target size`,
    dotBox.w >= MIN_TAP_TARGET_PX && dotBox.h >= MIN_TAP_TARGET_PX,
    {
      note: `${dotBox.w}x${dotBox.h}`,
      mismatch:
        dotBox.w >= MIN_TAP_TARGET_PX && dotBox.h >= MIN_TAP_TARGET_PX
          ? undefined
          : `${dotBox.w}x${dotBox.h} is under ${MIN_TAP_TARGET_PX}px`,
    },
  );
  if (dotBox.w < MIN_TAP_TARGET_PX || dotBox.h < MIN_TAP_TARGET_PX) failed = true;

  /* ── [6] Keyboard reaches the same slides */

  await page.eval(RESET);
  await sleep(500);
  await page.eval(`
    const s = document.querySelector(${JSON.stringify(SELECTOR)});
    s.focus();
    return document.activeElement === s;
  `);
  await page.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    windowsVirtualKeyCode: 35,
    key: "End",
    code: "End",
  });
  await page.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    windowsVirtualKeyCode: 35,
    key: "End",
    code: "End",
  });
  await sleep(1400);
  const viaKey = await page.eval(`
    const s = document.querySelector(${JSON.stringify(SELECTOR)});
    return { stack: Math.round(s.scrollTop), max: s.scrollHeight - s.clientHeight };
  `);
  results.record(
    "keyboard-end-key",
    "End glides the deck to its last slide",
    viaKey.stack === viaKey.max,
    {
      note: `stack=${viaKey.stack} max=${viaKey.max}`,
      mismatch: viaKey.stack === viaKey.max ? undefined : `stack=${viaKey.stack}, expected ${viaKey.max}`,
    },
  );
  if (viaKey.stack !== viaKey.max) failed = true;

  // The phone's touch handling is gated on a coarse primary pointer, and the
  // gate is asserted rather than assumed: a `touch-action: none` that leaked
  // onto desktop would take every wheel, trackpad and browser-native scroll away
  // from a browser that has a mouse.
  const desktopPointer = await page.eval(`
    const s = document.querySelector(${JSON.stringify(SELECTOR)});
    return {
      touchAction: getComputedStyle(s).touchAction,
      coarse: matchMedia("(pointer: coarse)").matches,
      fine: matchMedia("(pointer: fine)").matches,
    };
  `);
  results.record(
    "desktop-pointer-is-left-alone",
    "on a fine pointer the deck claims no gestures and claims no touch-action",
    desktopPointer.touchAction === "auto" &&
      desktopPointer.coarse === false &&
      desktopPointer.fine === true,
    {
      note: `touch-action=${desktopPointer.touchAction}, pointer:coarse=${desktopPointer.coarse}, ` +
        `pointer:fine=${desktopPointer.fine}`,
      mismatch:
        desktopPointer.touchAction !== "auto"
          ? `touch-action is ${desktopPointer.touchAction} on a fine pointer — every desktop scroll is now the deck's`
          : desktopPointer.coarse
            ? "this viewport reports a coarse pointer and is not exercising the desktop path"
            : undefined,
    },
  );
  if (desktopPointer.touchAction !== "auto" || desktopPointer.coarse) failed = true;

  results.record(
    "desktop-clean",
    "no page errors on the desktop deck",
    page.pageErrors.length === 0,
    { note: page.pageErrors.slice(0, 3).join(" | ") || "none" },
  );
  if (page.pageErrors.length) failed = true;
  await page.close();

  /* ── Phone ───────────────────────────────────────────────────────────── */

  const phone = await openPage(PORT, { width: 390, height: 844 });
  await phone.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await phone.goto(`${BASE}/`, { waitMs: 1500 });
  const pinfo = await phone.eval(START_SAMPLE);
  const pslide = pinfo.clientHeight;

/* ── [7] A FINGER IS A DESTINATION: ONE SWIPE, ONE SLIDE ──
   *
   * WHY THIS IS NOT [7]'S OLD RULE ANY MORE
   *
   * The deck used to leave a finger entirely to the browser, on the reasoning
   * that a finger is travel and travel should be the browser's business. On a
   * desktop that reasoning holds and still does. On a phone it does not, and the
   * reason is that the deck is UNSNAPPED and has EIGHT viewport-tall slides:
   *
   *   - a native fling is thrown as far as the compositor's fling curve carries
   *     it, which over that much travel is several slides for one ordinary flick;
   *   - and with no snap point there is nothing to re-seat the offset, so it rests
   *     wherever the fling decayed to.
   *
   * Both were measured before anything was changed. A flick covering 0.8 of a
   * slide came to rest at 675px of an 844px slide — 169px, a fifth of the way,
   * into slide two and stuck there. The old build had no velocity calculation to
   * over-sample and no momentum loop to sample too late: it had NO touch handling
   * at all, and "no touch handling" looks exactly like the bug report.
   *
   * So below a coarse primary pointer the deck takes the gesture itself: the
   * cover follows the finger one to one, and a lift resolves to exactly one
   * slide from the slide the gesture started on. Every assertion here is about
   * that resolution landing on a boundary, because the resolution is the part
   * that was broken — the tracking was never the complaint.
   */
  await phone.eval(RESET);
  await phone.eval(SETTLE_IMAGES);
  await sleep(500);

  /**
   * A real finger: down, `distance` px of travel in `steps` moves spaced
   * `stepMs` apart, up. A NEGATIVE distance is the finger travelling up the
   * screen, which is a swipe towards the next slide — the same way round as the
   * wheel in [0].
   *
   * `stepMs` is what makes this a SPEED matrix rather than a distance matrix.
   * The same 300px is a 2.5s crawl or a 24ms flick depending only on the spacing,
   * and a rule that could not hold across both of those was a rule keyed to one
   * of them.
   */
  async function finger(page, { from = 620, distance, steps = 6, stepMs = 16, settle = 1800 }) {
    await page.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 195, y: from, id: 1 }],
    });
    for (let i = 1; i <= steps; i++) {
      await page.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: 195, y: from + (distance * i) / steps, id: 1 }],
      });
      if (stepMs) await sleep(stepMs);
    }
    await page.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    if (settle) await sleep(settle);
  }

  const rest = () => phone.eval(`
    const s = document.querySelector(${JSON.stringify(SELECTOR)});
    return {
      stack: Math.round(s.scrollTop),
      exact: s.scrollTop,
      max: s.scrollHeight - s.clientHeight,
      page: Math.round(window.scrollY),
      path: location.pathname,
      snapType: getComputedStyle(s).scrollSnapType,
      touchAction: getComputedStyle(s).touchAction,
    };
  `);

  /** Park the deck on a slide boundary without animating, so a swipe starts known. */
  const parkOn = async (index) => {
    await phone.eval(`
      const s = document.querySelector(${JSON.stringify(SELECTOR)});
      s.scrollTo({ top: ${index} * s.clientHeight, behavior: "instant" });
      return true;
    `);
    await sleep(300);
  };

  // Four speeds, spanning a deliberate drag to a violent flick to a throw longer
  // than the whole deck. Reported in px/s.
  const SPEEDS = [
    { name: "slow", distance: -220, steps: 6, stepMs: 90 },
    { name: "normal", distance: -300, steps: 6, stepMs: 16 },
    { name: "fast", distance: -600, steps: 4, stepMs: 8 },
    { name: "very fast", distance: -2600, steps: 2, stepMs: 4 },
  ];
  const speedOf = (s) => Math.round(Math.abs(s.distance) / ((s.steps * s.stepMs) / 1000));

  const swipeReport = [];
  const swipeFailures = [];

  // Forward from several slides, not just the first: a rule that only holds from
  // the top of the deck is not a rule.
  for (const [index, expected] of [[0, 1], [1, 2], [2, 3]]) {
    for (const spec of SPEEDS) {
      await phone.eval(RESET);
      await parkOn(index);

      await finger(phone, spec);
      const after = await rest();

      if (after.path !== "/") {
        throw new Error(
          `a forward swipe at ${spec.name} speed navigated to ${after.path} instead of staying on the deck`,
        );
      }

      const want = expected * pslide;
      const ok = after.stack === want && Math.abs(after.exact - want) < 1;
      swipeReport.push(
        `forward from slide ${index} at ${spec.name} (${speedOf(spec)}px/s, ` +
          `${Math.abs(spec.distance)}px of finger travel): rested at ${after.stack}px ` +
          `= slide ${after.stack / pslide}${ok ? "" : `  <<< EXPECTED slide ${expected}`}`,
      );
      if (!ok) {
        swipeFailures.push(
          `forward from slide ${index} at ${spec.name} (${speedOf(spec)}px/s): rested at ` +
            `${after.stack}px (slide ${after.stack / pslide}), expected ${want}px (slide ${expected})`,
        );
        failed = true;
      }
    }
  }

  // And backwards, from each slide, at each speed. A bound that only works in one
  // direction is not a bound.
  for (const [index, expected] of [[3, 2], [2, 1], [1, 0]]) {
    for (const spec of SPEEDS) {
      await phone.eval(RESET);
      await parkOn(index);

      await finger(phone, { ...spec, distance: Math.abs(spec.distance) });
      const after = await rest();

      if (after.path !== "/") {
        throw new Error(`a backward swipe at ${spec.name} speed navigated to ${after.path}`);
      }

      const want = expected * pslide;
      const ok = after.stack === want && Math.abs(after.exact - want) < 1;
      swipeReport.push(
        `back from slide ${index} at ${spec.name} (${speedOf(spec)}px/s, ` +
          `${Math.abs(spec.distance)}px of finger travel): rested at ${after.stack}px ` +
          `= slide ${after.stack / pslide}${ok ? "" : `  <<< EXPECTED slide ${expected}`}`,
      );
      if (!ok) {
        swipeFailures.push(
          `back from slide ${index} at ${spec.name} (${speedOf(spec)}px/s): rested at ` +
            `${after.stack}px (slide ${after.stack / pslide}), expected ${want}px (slide ${expected})`,
        );
        failed = true;
      }
    }
  }

  console.log(
    `\n  Swipe matrix (slide = ${pslide}px, commit distance = ${Math.max(40, pslide * 0.1).toFixed(0)}px):`,
  );
  for (const line of swipeReport) console.log(`    ${line}`);

  results.record(
    "one-swipe-is-one-slide-at-every-speed-and-in-both-directions",
    "every swipe at four speeds, forwards and backwards, moves exactly one slide",
    swipeFailures.length === 0,
    {
      note: `${swipeReport.length} swipes, every one landing exactly on a slide boundary`,
      mismatch: swipeFailures.join("; "),
    },
  );

  /* ── [7b] The deck takes the gesture, so the compositor cannot add to it ──
   *
   * This is the other half of the bug, and the half that is easy to get subtly
   * wrong. If the deck tracks the finger AND the browser is still free to scroll
   * this container, one flick drives three things at once — the deck's own
   * tracking, a native scroll, and a fling — and they add up. So on a coarse
   * pointer the deck has to claim the `touchmove`. `touchstart` and `touchend`
   * stay untouched: there is nothing to suppress there, and a compatibility click
   * on the category link under the finger has to survive so a tap is still a tap.
   */
  await phone.eval(RESET);
  await sleep(400);
  await phone.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 195, y: 620, id: 1 }],
  });
  await phone.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 195, y: 420, id: 1 }],
  });
  await sleep(120);
  await phone.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(1600);
  const claimed = await phone.eval(`
    const s = document.querySelector(${JSON.stringify(SELECTOR)});
    const seen = {};
    // A real drag, not a stationary finger: the axis is only locked once the
    // gesture has travelled, and before that the deck must NOT preventDefault —
    // claiming a touchmove it has not yet decided about would take horizontal
    // panning away from whatever else might want it.
    const y = { touchstart: 620, touchmove: 420 };
    for (const type of ["touchstart", "touchmove", "touchend"]) {
      const e = new TouchEvent(type, { bubbles: true, cancelable: true });
      Object.defineProperty(e, "touches", {
        value: type === "touchend" ? [] : [{ clientX: 195, clientY: y[type] }],
      });
      s.dispatchEvent(e);
      seen[type] = e.defaultPrevented;
    }

    // Three pixels of travel, under the axis lock. The deck has not decided
    // which way this gesture is going, so it must leave it alone — a thumb
    // resting on a cover produces this constantly, and claiming it would break
    // horizontal panning on the first frame of every touch.
    let seenUndecided = null;
    const undecidedStart = new TouchEvent("touchstart", { bubbles: true, cancelable: true });
    Object.defineProperty(undecidedStart, "touches", { value: [{ clientX: 195, clientY: 620 }] });
    s.dispatchEvent(undecidedStart);
    const undecidedMove = new TouchEvent("touchmove", { bubbles: true, cancelable: true });
    Object.defineProperty(undecidedMove, "touches", { value: [{ clientX: 195, clientY: 617 }] });
    s.dispatchEvent(undecidedMove);
    seenUndecided = undecidedMove.defaultPrevented;
    s.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true }));
    return { seen, undecided: seenUndecided, stack: Math.round(s.scrollTop) };
  `);

  results.record(
    "the-deck-claims-the-drag-so-the-compositor-cannot-add-to-it",
    "a real drag's touchmove is the deck's own; touchstart/touchend and an undecided gesture are left alone",
    claimed.seen.touchmove === true &&
      claimed.seen.touchstart === false &&
      claimed.seen.touchend === false &&
      claimed.undecided === false,
    {
      note: `${Object.entries(claimed.seen).map(([k, v]) => `${k}=${v}`).join(", ")}; ` +
        `3px of travel prevented=${claimed.undecided}; rest=${claimed.stack}px`,
      mismatch:
        claimed.seen.touchmove !== true
          ? "a 200px drag's touchmove was not preventDefault'd — the compositor is still scrolling this container as well"
          : claimed.undecided === true
            ? "a 3px nudge was preventDefault'd — the deck is claiming gestures before it knows their direction"
            : Object.entries(claimed.seen).find(([type, blocked]) => type !== "touchmove" && blocked)
              ? `${Object.entries(claimed.seen).find(([type, blocked]) => type !== "touchmove" && blocked)[0]} was preventDefault'd`
              : undefined,
    },
  );
  if (
    claimed.seen.touchmove !== true ||
    claimed.undecided === true ||
    claimed.seen.touchstart ||
    claimed.seen.touchend
  ) {
    failed = true;
  }

  // The cover follows the finger while it is down, which is the tactile half of
  // "feels like a dot click" — a dot click with a real drag in between.
  await phone.eval(RESET);
  await sleep(400);
  await phone.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 195, y: 700, id: 1 }],
  });
  await phone.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 195, y: 500, id: 1 }],
  });
  await sleep(150);
  const underFinger = await phone.eval(`
    const s = document.querySelector(${JSON.stringify(SELECTOR)});
    return { stack: Math.round(s.scrollTop) };
  `);
  await phone.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(1600);
  const afterDrag = await rest();

  results.record(
    "the-cover-tracks-the-finger-one-to-one-while-it-is-down",
    "200px of finger travel moves the cover 200px, mid-gesture, before any lift",
    underFinger.stack === 200,
    {
      note: `under the finger: ${underFinger.stack}px; after the lift: ${afterDrag.stack}px (slide 1)`,
      mismatch:
        underFinger.stack === 200
          ? undefined
          : `the finger had moved 200px and the cover had moved ${underFinger.stack}px — it is not tracking 1:1`,
    },
  );
  if (underFinger.stack !== 200) failed = true;

  results.record(
    "phone-deck-has-no-snap",
    "the browser is given no snap point — the deck lands on a slide by deciding to, not by being re-seated",
    afterDrag.snapType === "none",
    {
      note: `scroll-snap-type=${afterDrag.snapType}`,
      mismatch:
        afterDrag.snapType === "none"
          ? undefined
          : `scroll-snap-type is ${afterDrag.snapType} — the compositor can still re-seat the deck`,
    },
  );
  if (afterDrag.snapType !== "none") failed = true;

  results.record(
    "the-phone-deck-takes-the-gesture-away-from-the-compositor",
    "touch-action is none under a coarse pointer, so the deck's tracking is the only thing scrolling",
    afterDrag.touchAction === "none",
    {
      note: `touch-action=${afterDrag.touchAction}`,
      mismatch:
        afterDrag.touchAction === "none"
          ? undefined
          : `touch-action is ${afterDrag.touchAction} — the deck's own tracking and a native scroll would both run`,
    },
  );
  if (afterDrag.touchAction !== "none") failed = true;

  /* ── [7c] A tap is not a swipe, and neither is a shift ──
   *
   * A tap has to be a tap: the slide under the finger is a link to /shop, and a
   * deck that moved on a tap would take the shopper to another slide and then
   * navigate them out of the deck they were reading. The click is shielded so a
   * probe tap cannot navigate on its own, and the path is asserted afterwards.
   */
  await phone.eval(RESET);
  await sleep(400);
  await phone.eval(`
    window.__probeShield = (e) => { e.preventDefault(); e.stopPropagation(); };
    document.addEventListener("click", window.__probeShield, { capture: true });
    return true;
  `);
  await phone.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 195, y: 520, id: 1 }],
  });
  await sleep(120);
  await phone.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(1600);
  const tapped = await rest();
  await phone.eval(`
    document.removeEventListener("click", window.__probeShield, { capture: true });
    return true;
  `);

  results.record(
    "a-tap-with-no-travel-does-not-move-the-deck",
    "a tap neither swipes nor nudges the cover, so the link under the finger still works",
    tapped.stack === 0 && tapped.path === "/",
    {
      note: `stack=${tapped.stack}px path=${tapped.path}`,
      mismatch:
        tapped.stack !== 0
          ? `a tap moved the deck to ${tapped.stack}px (slide ${tapped.stack / pslide})`
          : tapped.path !== "/"
            ? `the tap navigated to ${tapped.path}`
            : undefined,
    },
  );
  if (tapped.stack !== 0 || tapped.path !== "/") failed = true;

  // And a gesture too short to be a swipe snaps back to where it started rather
  // than being left stranded between two slides — the other half of the report:
  // a shift must not park the cover off a boundary.
  await phone.eval(RESET);
  await sleep(400);
  const commit = Math.max(40, pslide * 0.1);
  const nudge = Math.max(2, Math.round(commit) - 30);
  await finger(phone, { distance: -nudge, steps: 3, stepMs: 16 });
  const nudged = await rest();

  results.record(
    "a-shift-too-short-to-be-a-swipe-lands-back-on-the-slide",
    `a ${nudge}px drag snaps back rather than parking the cover off a boundary`,
    nudged.stack === 0,
    {
      note: `${nudge}px of finger travel -> ${nudged.stack}px (commit distance is ${commit.toFixed(0)}px)`,
      mismatch:
        nudged.stack === 0
          ? undefined
          : `a ${nudge}px drag left the cover at ${nudged.stack}px, ` +
            `${offBoundary(nudged.stack, pslide).toFixed(0)}px off the slide boundary`,
    },
  );
  if (nudged.stack !== 0) failed = true;

  // [9] No horizontal overflow, and the dots stay on screen.
  const phoneLayout = await phone.eval(`
    const section = document.querySelector('section[aria-label="Featured"]');
    const scroller = section.querySelector(":scope > div");
    const dots = document.querySelector('section[aria-label="Featured"] [role="group"]');
    const dr = dots?.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      scrollerWidth: Math.round(scroller.getBoundingClientRect().width),
      innerWidth: window.innerWidth,
      dotsOnScreen: dr ? dr.right <= window.innerWidth + 1 && dr.left >= -1 : false,
    };
  `);
  results.record(
    "phone-no-horizontal-overflow",
    "the stack adds no horizontal overflow at 390px",
    phoneLayout.overflow <= 0,
    {
      note: `overflow=${phoneLayout.overflow}px`,
      mismatch: phoneLayout.overflow <= 0 ? undefined : `${phoneLayout.overflow}px of horizontal overflow`,
    },
  );
  results.record(
    "phone-dots-on-screen",
    "the dots stay inside the viewport at 390px",
    phoneLayout.dotsOnScreen && phoneLayout.scrollerWidth <= phoneLayout.innerWidth + 1,
    {
      note: `dotsOnScreen=${phoneLayout.dotsOnScreen} stack=${phoneLayout.scrollerWidth} inner=${phoneLayout.innerWidth}`,
      mismatch:
        phoneLayout.dotsOnScreen && phoneLayout.scrollerWidth <= phoneLayout.innerWidth + 1
          ? undefined
          : `dotsOnScreen=${phoneLayout.dotsOnScreen} stack=${phoneLayout.scrollerWidth} inner=${phoneLayout.innerWidth}`,
    },
  );
  if (phoneLayout.overflow > 0 || !phoneLayout.dotsOnScreen) failed = true;

  results.record(
    "phone-clean",
    "no page errors on the phone deck",
    phone.pageErrors.length === 0,
    { note: phone.pageErrors.slice(0, 3).join(" | ") || "none" },
  );
  if (phone.pageErrors.length) failed = true;
  await phone.close();
} finally {
  await chrome.close();
}
const summary = results.summary("Homepage category slide stack");
process.exit(failed || summary.fail > 0 ? 1 : 0);
