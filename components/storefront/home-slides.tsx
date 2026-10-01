"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import { resolveImageUrl } from "@/lib/images";
import { categoryHref } from "@/lib/storefront/format";
import {
  easeOutSlide,
  slideDuration,
  swipeAxis,
  swipeCommits,
} from "@/lib/storefront/slide-motion";
import type { Category } from "@/lib/storefront/types";

type HomeSlidesProps = {
  /** Server-rendered hero, passed straight through as the first slide. */
  hero: ReactNode | null;
  categories: Category[];
  /**
   * Server-rendered footer, passed straight through as the deck's closing slide.
   *
   * The homepage owns its own footer so it can become the last full-height slide
   * in this stack; every other route gets its footer from the layout's `@footer`
   * parallel slot and passes nothing here. Omit it and the deck simply has one
   * fewer slide.
   */
  footer?: ReactNode;
};

type CategorySlideProps = {
  category: Category;
  /** The slide right below the hero is almost always seen immediately. */
  eager: boolean;
};

/**
 * Full-screen homepage slide stack: the hero, one full-bleed slide per
 * category, and then the footer as the closing slide, in the order the
 * storefront data layer returns them. The footer arrives as a prop rather than
 * from the layout because only the homepage can place it inside this stack;
 * every other route renders an ordinary footer through the layout's `@footer`
 * slot.
 *
 * THE MECHANISM: STICKY, NOT SNAP, AND NOT A TRANSFORM
 *
 * Every slide is `position: sticky; top: 0` and one viewport tall, stacked in
 * DOM order inside a scroll container one viewport tall. That alone is the
 * whole effect, and it is worth being precise about why:
 *
 *   The container's scroll distance is (N - 1) slide heights, because a sticky
 *   child can never be pushed above the bottom of its containing block — and
 *   the containing block here is the deck. Slide i is therefore pinned at the
 *   top of the scrollport the instant it arrives, and it is never pushed back
 *   out; the slide above it keeps scrolling up and paints over it (positioned
 *   siblings with `z-index: auto` paint in tree order, so DOM order IS the
 *   stacking order, and the last slide is the last to arrive). At the maximum
 *   scroll offset the final slide sits exactly at the top of the scrollport and
 *   the deck is out of room — which is why there is no scroll trap and nothing
 *   to hand back at the end.
 *
 *   This replaced a `scroll-snap` deck, which could only ever answer a gesture
 *   with a snap point, and a rAF transform layer, which re-derives the very
 *   offset the browser has already resolved. Both of those had to guess: one
 *   turned travel into a destination, the other put slide positions on the
 *   main thread. Sticky puts the position where the platform keeps scroll
 *   position — the compositor — so the motion is continuous, it is driven by
 *   scroll rather than by a timer, and scrolling up is the exact reverse of
 *   scrolling down for free rather than by a second mirrored formula that has
 *   to be kept in step with the first.
 *
 * WHAT THIS CHANGES, DELIBERATELY
 *
 *   THE WHEEL IS NO LONGER READ AS INTENT. It used to be: a notch is ~100px and
 *   a slide is ~900px, so a short push could never cross one, and the deck
 *   answered a gesture with a whole-slide glide rather than with the travel it
 *   was given. That only made sense while a snap point was there to undo a
 *   partial scroll. With the stack covering continuously, travel and motion are
 *   the same thing again: a notch moves the cover by a notch, a trackpad flicks
 *   as far as it was thrown, and the slide under the finger is the slide the
 *   shopper is looking at. Wheel, trackpad and touch are all just scrolling now,
 *   which is also what makes them agree with each other in both directions.
 *
 *   DOTS AND ARROW KEYS STILL JUMP. Those are discrete destinations rather
 *   than travel, so they keep the eased glide (`useSlideGlide`) — a tween of
 *   the scroll offset, which the sticky stack then follows the whole way. A dot
 *   click is the one input that should cover a slide in ~500ms because the
 *   shopper asked for a specific slide; nothing else should.
 *
 *   A FINGER IS A DESTINATION TOO, ON A PHONE ONLY. This is the one place the
 *   "travel is motion" rule above does not hold, and it is the reason: a finger
 *   on a phone is not a scroll wheel, it is the deck's own dot rail being
 *   dragged. Left to the browser it is the worst of both — `useSlideDeckTouch`
 *   exists because it was measured to be the worst of both. A deck with no snap
 *   point takes a native fling as far as the compositor throws it, which over
 *   eight viewport-tall slides is two or three of them for one ordinary flick;
 *   and with nothing to re-seat it, the offset then rests wherever the fling
 *   died, which is almost never a slide. Measured on a 390x844 phone viewport:
 *   one flick covering 0.8 of a slide came to rest at 675px of an 844px slide —
 *   169px, or a fifth of the way, into slide two, and stuck there. On a phone
 *   that is not "a finger tracks the cover", it is a deck with nowhere to go.
 *
 *   So on a coarse pointer the deck takes the gesture itself: the cover follows
 *   the finger one to one while it is down, and a lift always resolves to
 *   exactly one slide forward or back — the same answer a dot click gives. It
 *   cannot land between two slides, because every resting offset it can produce
 *   is `index * slideHeight` by construction. See `useSlideDeckTouch`.
 *
 *   Every desktop input is untouched by any of this: wheel and trackpad are
 *   still travel, still land mid-cover and still travel the distance they were
 *   given, and the touch handling never runs unless the primary pointer is
 *   coarse.
 *
 *   The container keeps the default `overscroll-behavior` for the same reason
 *   it always has: once the deck is at its last slide it has nothing left to
 *   scroll, so the wheel has to belong to the page again.
 */
export function HomeSlides({ hero, categories, footer }: HomeSlidesProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // The stack is the first thing on the page, so the dots start visible and
  // only the observer (attached after hydration) can take them away.
  const [inView, setInView] = useState(true);
  // The keyboard handler is attached once but has to read the slide it is on,
  // and re-attaching it per index would drop key events mid-move.
  const activeIndexRef = useRef(0);

  // Dot order mirrors the DOM order of the slides below: hero, one per
  // category, then the footer as the closing slide.
  const slideCount = (hero ? 1 : 0) + categories.length + (footer ? 1 : 0);
  const footerIndex = footer ? slideCount - 1 : -1;

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const {
    glideTo: runGlide,
    isGliding,
    isOwnOffset,
    stopGlide,
  } = useSlideGlide(scrollerRef, slideCount);

  /**
   * The destination is known the instant the shopper asks for it, so the deck
   * records it straight away: the dots travel with the glide instead of
   * trailing it, and the next key press is measured from where the deck is
   * going rather than from wherever this frame happens to have caught it.
   */
  const glideTo = useCallback(
    (index: number) => {
      const target = Math.min(Math.max(index, 0), Math.max(0, slideCount - 1));
      activeIndexRef.current = target;
      setActiveIndex(target);
      runGlide(target);
    },
    [runGlide, slideCount],
  );

  const setActive = useCallback((index: number) => {
    if (index === activeIndexRef.current) return;
    activeIndexRef.current = index;
    setActiveIndex(index);
  }, []);

  // Hide the dots as soon as the stack stops being the dominant thing on
  // screen, so they never sit on top of the sections underneath it.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting && entry.intersectionRatio >= 0.5);
      },
      { threshold: [0, 0.5, 1] },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // Which slide is on top, read from the scroll offset.
  //
  // This used to be measured with an IntersectionObserver over the slides, and
  // that no longer works at all: every slide in a sticky stack is pinned at the
  // top of the scrollport and fully inside it for the whole of the deck's
  // travel, so every slide reports an intersection ratio of 1 and the observer
  // cannot tell them apart. The offset the deck already has is the honest
  // answer — it is literally the position the cover is at.
  //
  // The offset is read once per animation frame rather than once per scroll
  // event, so a fling that fires a scroll event per frame costs exactly one
  // layout read per frame and the handler itself does no work at all.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || slideCount < 2) return;

    let frame = 0;

    const read = () => {
      frame = 0;

      const height = scroller.clientHeight;
      if (height <= 0) return;

      setActive(coveredIndex(scroller.scrollTop, height, slideCount));
    };

    /**
     * A glide is the deck's own motion, and its own scroll events say nothing
     * new. An offset that moved without it does: a wheel or a finger landing
     * mid-glide is the shopper taking the deck back, and the deck has to get out
     * of the way rather than tween the offset back over the top of them.
     *
     * That check belongs here, synchronously, and not in `read()`. A browser
     * dispatches `scroll` before the animation frames of the frame it belongs
     * to, so a glide's next step is still queued at this point and cancelling it
     * here removes it before it can run. Deferred to `read()`, the step would
     * run first, write the tween's offset over the one the shopper had just
     * produced, leave that offset looking like ours — and the glide would keep
     * the deck for the rest of its run and ignore the wheel entirely.
     */
    const onScroll = () => {
      if (isGliding() && !isOwnOffset()) stopGlide();
      if (frame !== 0) return;
      frame = requestAnimationFrame(read);
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    read();

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", onScroll);
    };
  }, [isGliding, isOwnOffset, setActive, slideCount, stopGlide]);

  // Leave a glide in flight when the component goes away, or it keeps writing
  // to a detached scroller.
  useEffect(() => stopGlide, [stopGlide]);

  // A finger on a phone is a destination, not travel: one swipe, one slide, and
  // it can only ever come to rest on a slide. Wheel, trackpad, dots and keys are
  // untouched by this — it installs nothing unless the primary pointer is
  // coarse, and it is the coarse pointer's `touch-action: none` that stops the
  // compositor from also scrolling, so the two never both move the deck.
  useSlideDeckTouch({ scrollerRef, slideCount, glideTo, stopGlide });

  const goToSlide = useCallback(
    (index: number) => {
      glideTo(index);
    },
    [glideTo],
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const forwards: Record<string, number> = {
        ArrowDown: 1,
        ArrowRight: 1,
        PageDown: 1,
      };
      const backwards: Record<string, number> = {
        ArrowUp: -1,
        ArrowLeft: -1,
        PageUp: -1,
      };

      let next: number | null = null;
      if (event.key in forwards) next = activeIndex + forwards[event.key];
      else if (event.key in backwards) next = activeIndex + backwards[event.key];
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = slideCount - 1;

      if (next === null) return;
      event.preventDefault();
      glideTo(next);
    },
    [activeIndex, glideTo, slideCount],
  );

  const activeSlide =
    activeIndex === footerIndex
      ? "Footer"
      : activeIndex === 0
        ? hero
          ? "Hero"
          : null
        : (categories[activeIndex - 1]?.name ?? null);

  return (
    <section
      ref={sectionRef}
      aria-label="Featured"
      aria-roledescription="carousel"
      className="relative -mt-32 sm:-mt-40"
    >
      <div
        ref={scrollerRef}
        // A scroll container that holds focusable content has to be focusable
        // itself, or the slides are unreachable by keyboard.
        tabIndex={0}
        role="group"
        aria-label="Slide deck"
        onKeyDown={onKeyDown}
        // `touch-none`, and only under a coarse pointer, is what hands the
        // gesture to `useSlideDeckTouch`: with the browser also free to scroll
        // this container, one finger would drive the deck's own tracking AND a
        // native scroll AND a fling, and the three would add up to several slides
        // of travel for one flick. The trade is pinch-zoom inside the deck, which
        // is a full-screen cover stack by definition; pinch-zoom everywhere else
        // on the page is unchanged.
        className="h-[100svh] overflow-y-auto [@media(pointer:coarse)]:touch-none [-ms-overflow-style:none] [scrollbar-width:none] focus-visible:outline-plum [&::-webkit-scrollbar]:hidden"
      >
        {hero ? (
          <div className="sticky top-0 h-[100svh]">{hero}</div>
        ) : null}

        {categories.map((category, index) => (
          <CategorySlide
            key={category.id}
            category={category}
            eager={index === 0}
          />
        ))}

        {footer ? (
          <div
            data-slide="footer"
            aria-label="Footer"
            className="sticky top-0 h-[100svh] overflow-y-auto bg-ivory [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
          >
            {/*
              The footer's own markup is untouched — this only decides where it
              sits inside the slide. Centring rather than stretching keeps it
              looking identical to the layout footer when its natural height is
              under a viewport (desktop), and the slide itself scrolls when it
              is not (phone, where four columns stack).
            */}
            <div className="flex min-h-[100svh] items-center justify-center">
              {footer}
            </div>
          </div>
        ) : null}
      </div>

      {slideCount > 1 ? (
        <>
          <p aria-live="polite" className="sr-only">
            {`Slide ${activeIndex + 1} of ${slideCount}${activeSlide ? `: ${activeSlide}` : ""}`}
          </p>

          <div
            role="group"
            aria-label="Slides"
            className={`fixed right-1 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center transition-opacity duration-300 sm:right-4 ${
              inView ? "opacity-100" : "invisible opacity-0 pointer-events-none"
            }`}
          >
            {Array.from({ length: slideCount }, (_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Go to slide ${index + 1}`}
                aria-current={activeIndex === index ? "true" : undefined}
                onClick={() => goToSlide(index)}
                // 44px of hit area around an 8px dot. The rail is measured
                // against the project's own 44px tap-target rule
                // (tests/qa/tap-targets.mjs), which the dots used to fail by
                // more than half at 20x20 — on the one control a shopper has to
                // hit precisely on a phone.
                //
                // `-my-1.5` pulls each button 6px into the one above and below
                // it, so the pitch between dot CENTRES is 32px instead of 44px
                // and the rail is 24px shorter per dot. Eight stacked at 44px
                // ran 352px up the right edge, which read as a ladder rather
                // than a slider control; at 32px the whole rail is 268px and
                // sits comfortably inside a phone viewport next to the content.
                // Every button is still a full 44x44 box — the negative margin
                // only overlaps neighbours, it never shrinks one. A tap lands
                // on the dot it looks like it landed on: the centres are 32px
                // apart and the boxes overlap by only 12px, so the exclusive
                // zone around each dot runs 10px past its centre in each
                // direction before a neighbour takes over.
                className="-my-1.5 flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-plum"
              >
                <span
                  aria-hidden="true"
                  className={`block h-2 w-2 rounded-full transition-colors duration-300 ${
                    activeIndex === index
                      ? "bg-charcoal shadow-[0_0_0_1px_rgba(255,255,255,0.6)]"
                      : "bg-white shadow-[0_0_0_1px_rgba(43,38,34,0.18),0_1px_3px_rgba(43,38,34,0.35)]"
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

/**
 * Which slide is covering the top of the scrollport at `offset`.
 *
 * The cover is continuous, so this is a question about where in a transition
 * the deck is rather than a question about which slide is on screen — both are
 * true at once through the middle of a cover, and only the second one is worth
 * showing. Rounding to the nearest slide is what makes a dot mean "this is the
 * slide you are looking at" instead of "this is the slide you have started
 * leaving".
 *
 * Rounding is also the whole answer to a slow frame landing near a boundary: the
 * dot can only change on the far side of the midpoint, and an offset that comes
 * back within half a pixel of it answers the same way it did a moment earlier.
 * That is the band a trackpad's last millimetre of deceleration actually needs,
 * and it is already in `Math.round` — adding a second threshold on top of it
 * would only buy a pixel while adding a number to keep in step with the curve.
 */
function coveredIndex(offset: number, slideHeight: number, slideCount: number): number {
  const nearest = Math.round(offset / slideHeight);
  return Math.min(slideCount - 1, Math.max(0, nearest));
}

type SlideDeckTouch = {
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  slideCount: number;
  glideTo: (index: number) => void;
  stopGlide: () => void;
};

/**
 * ONE FINGER, ONE SLIDE, AND IT ALWAYS LANDS ON A SLIDE
 *
 * WHY THIS EXISTS
 *
 *   The deck is a sticky stack with no snap point, which is right for a wheel
 *   and wrong for a phone. Left to the browser, one ordinary flick produced two
 *   or three slides of travel and then stopped wherever the fling decayed to —
 *   measured at 675px of an 844px slide, a fifth of the way into slide two and
 *   stuck there, because on an unsnapped container the offset a fling dies at is
 *   simply the offset the deck now has. There was no gesture to mis-measure and
 *   no momentum loop to over-sample: the deck had no touch handling at all, and
 *   both symptoms are what "no touch handling" looks like.
 *
 * WHAT IT DOES
 *
 *   Below a coarse primary pointer, and only then:
 *
 *     touchstart  stop any glide (a finger landing mid-glide is the shopper
 *                 taking the deck back) and remember the offset, the slide that
 *                 offset is on, and the finger.
 *
 *     touchmove   once the gesture is clearly vertical, take it — preventDefault
 *                 so the compositor's own scroll does not add to ours — and
 *                 write `startOffset + (startY - y)`. The cover tracks the
 *                 finger one to one, so the drag can be felt, reversed, and
 *                 dragged back, exactly as the wheel does on desktop.
 *
 *     touchend    resolve. Past the commit distance, exactly one slide from the
 *                 slide the gesture STARTED on, in the direction it was thrown,
 *                 clamped to the deck. Short of that, back to where it started.
 *
 * WHY THE DESTINATION IS `startIndex ± 1` AND NOT A SAMPLE OF THE END OFFSET
 *
 *   Two different questions have to be kept apart. "Which slide is showing" is
 *   `coveredIndex`, and it answers the dot rail. "Where does this gesture go"
 *   is a decision about the gesture, and it has to be anchored to where the
 *   gesture started: a throw that crossed a slide boundary and came back to 0.6
 *   is not an ask for slide N+2, and reading the end offset is precisely how a
 *   single flick turns into a two- or three-slide jump. Anchoring to
 *   `startIndex` and adding at most one is what makes the bound a bound rather
 *   than an average.
 *
 * WHY IT CANNOT STOP BETWEEN TWO SLIDES
 *
 *   Not by checking the offset afterwards, which is the check that was failing
 *   before: it can only be out by exactly as much as the compositor rounded the
 *   last write, so a "settle" still needed a threshold, and a threshold near
 *   the boundary is what produces a visible re-seat. It cannot stop between two
 *   slides because there is no path that leaves it there. Every offset this hook
 *   produces is one of `startOffset + drag` (in flight, under the finger) or
 *   `index * clientHeight` (settled, via `glideTo`), and the second one is an
 *   exact multiple of the slide height by construction.
 *
 * WHY VELOCITY IS NOT USED
 *
 *   The old build's version of this measured how fast the finger was moving to
 *   decide how far to go, and that is where a momentum calculation goes wrong:
 *   a fast flick reports a velocity that says two slides and a slow drag of the
 *   same distance reports almost none, so the distance the shopper asked for and
 *   the distance the deck travels stop being the same thing. Distance alone is
 *   enough, is measurable without a stopwatch, and has no fast case to get
 *   wrong. A slow deliberate drag of a whole slide commits one slide, which is
 *   the right answer for that gesture too.
 *
 * WHAT IT DOES NOT TOUCH
 *
 *   Wheel and trackpad still travel and still come to rest mid-cover; the hook
 *   installs nothing unless `(pointer: coarse)` matches the PRIMARY pointer, so
 *   a touchscreen laptop driven by its trackpad is unaffected. A tap with no
 *   travel never commits and never nudges the offset, which leaves the category
 *   link under the finger free to navigate. Two fingers is a pinch, and is
 *   handed straight back.
 */
function useSlideDeckTouch({
  scrollerRef,
  slideCount,
  glideTo,
  stopGlide,
}: SlideDeckTouch): void {
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || slideCount < 2) return;

    let tracking = false;
    let startY = 0;
    let startX = 0;
    let startOffset = 0;
    let startIndex = 0;
    /** Content travel so far: positive is towards the last slide. */
    let travel = 0;
    let axis: ReturnType<typeof swipeAxis> = "undecided";

    const highestOffset = () => Math.max(0, scroller.scrollHeight - scroller.clientHeight);

    /**
     * Settle the gesture. `commit` is the swipe question, already answered, so
     * this only has to pick a legal index and hand it to the glide.
     */
    const settle = (commit: boolean) => {
      if (!tracking) return;
      tracking = false;
      axis = "undecided";

      // A tap that moved nothing is not a swipe and is not a re-seat either. It
      // has to leave the deck byte-for-byte where it was, because the thing
      // under the finger is a link and the shopper is about to follow it.
      if (!commit && Math.abs(scroller.scrollTop - startOffset) < 0.5) return;

      const lastIndex = slideCount - 1;
      const target =
        commit && travel !== 0
          ? Math.min(Math.max(startIndex + Math.sign(travel), 0), lastIndex)
          : startIndex;

      glideTo(target);
    };

    const onTouchStart = (event: TouchEvent) => {
      // Two fingers is a pinch. Hand the whole gesture back rather than tracking
      // half of it.
      if (event.touches.length !== 1) {
        tracking = false;
        return;
      }
      if (!primaryPointerIsCoarse()) return;

      const height = scroller.clientHeight;
      if (height <= 0) return;

      // A finger landing on a glide is the shopper taking the deck back; the
      // glide has to stand down before the first move, not after.
      stopGlide();

      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      startOffset = scroller.scrollTop;
      // The slide the gesture is anchored to: the one it started on, which is
      // the dot the shopper can currently see marked.
      startIndex = coveredIndex(startOffset, height, slideCount);
      travel = 0;
      axis = "undecided";
      tracking = true;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!tracking) return;
      if (event.touches.length !== 1) {
        tracking = false;
        return;
      }

      const dx = event.touches[0].clientX - startX;
      const dy = startY - event.touches[0].clientY;
      axis = swipeAxis(dx, dy);
      if (axis === "horizontal") {
        tracking = false;
        return;
      }
      // Still undecided — not enough travel to know which way this is going.
      if (axis === "undecided") return;

      // This container's scroll is ours now. Without this the compositor scrolls
      // it as well and the two stack.
      event.preventDefault();

      travel = dy;
      const height = scroller.clientHeight;
      if (height <= 0) return;

      scroller.scrollTop = Math.min(
        Math.max(startOffset + dy, 0),
        highestOffset(),
      );
    };

    const onTouchEnd = () => {
      if (!tracking) return;
      const height = scroller.clientHeight;
      settle(height > 0 && swipeCommits(travel, height));
    };

    // `touchcancel` is a lift the system took away — an incoming call, a
    // system gesture. Same question as a lift, and it has to be asked, or the
    // cover stays wherever the interrupt left it.
    const onTouchCancel = onTouchEnd;

    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    // Deliberately NOT passive: preventDefault below is the whole point.
    scroller.addEventListener("touchmove", onTouchMove, { passive: false });
    scroller.addEventListener("touchend", onTouchEnd, { passive: true });
    scroller.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchmove", onTouchMove);
      scroller.removeEventListener("touchend", onTouchEnd);
      scroller.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [glideTo, scrollerRef, slideCount, stopGlide]);
}

/**
 * Whether the PRIMARY pointer is coarse, i.e. whether this is really a phone or
 * tablet rather than a desktop browser that happens to have a touchscreen.
 *
 * `pointer`, not `any-pointer`: on a touchscreen laptop the mouse is the primary
 * pointer, so a mouse drag has to stay travel and a wheel has to stay travel,
 * and only a finger actually touching the screen should be a swipe.
 */
function primaryPointerIsCoarse(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

type SlideGlide = {
  /** Glide to a slide index, clamped to the slides that exist. */
  glideTo: (index: number) => void;
  /** True while a glide is running. Read through a function, never re-rendered. */
  isGliding: () => boolean;
  /**
   * True when the scroller's offset is still the one this glide last wrote.
   *
   * Reading this from the scroll handler is how the deck tells its own motion
   * apart from the shopper's: same offset means the glide owns the deck and its
   * scroll events carry no news, a different one means a wheel or a finger has
   * taken over and the glide has to stand down.
   */
  isOwnOffset: () => boolean;
  stopGlide: () => void;
};

/**
 * The one animation the deck owns: an eased glide between slide offsets.
 *
 * Only the two discrete inputs go through here — the dot rail and the arrow
 * keys. Wheel, trackpad and touch do not, and that is the point of the sticky
 * stack: they are travel, so the browser's own scrolling already produces the
 * exact motion asked for. A glide is for a destination, not for a gesture.
 *
 * The glide writes `scrollTop` on a rAF loop rather than leaning on
 * `scroll-behavior: smooth`, for two measured reasons. The CSS value animates
 * every scroll in the container including the ones the browser is about to make
 * on its own, so a 100px notch ended up taking ~800ms to travel 239px and
 * return; and a browser-driven smooth scroll cannot be retargeted halfway, so
 * clicking a second dot mid-move restarted from the wrong place. A rAF glide
 * starts from wherever the deck currently is, so a second input blends into the
 * first instead of fighting it, and it runs the exact curve the unit tests pin.
 *
 * Nothing stands snap down any more — there is no snap to fight — but the glide
 * does still yield. The scroll handler above calls `stopGlide` the moment the
 * offset stops being ours, so a wheel or a finger landing mid-glide wins
 * immediately rather than being tweened back over the top of.
 */
function useSlideGlide(
  scrollerRef: React.RefObject<HTMLDivElement | null>,
  slideCount: number,
): SlideGlide {
  const frameRef = useRef<number | null>(null);
  const glidingRef = useRef(false);
  const writtenRef = useRef(0);

  const stopGlide = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    glidingRef.current = false;
  }, []);

  const glideTo = useCallback(
    (index: number) => {
      const scroller = scrollerRef.current;
      if (!scroller || slideCount < 1) return;

      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

      const lastIndex = Math.max(0, slideCount - 1);
      const target =
        Math.min(Math.max(index, 0), lastIndex) * scroller.clientHeight;
      const from = scroller.scrollTop;
      const distance = Math.abs(target - from);

      if (distance < 1) {
        // Already there, within the compositor's rounding. Nothing to animate,
        // but the write still happens: `distance` can be the 0.3px a lift left
        // behind after one-to-one tracking, and a glide that returns early
        // without correcting it is how a deck that always lands on a slide ends
        // up resting a fraction of a pixel off one. It is a sub-pixel move, so
        // nothing is visible; it is just the difference between an offset that
        // is a multiple of the slide height and one that nearly is.
        scroller.scrollTop = target;
        writtenRef.current = target;
        glidingRef.current = false;
        frameRef.current = null;
        return;
      }

      glidingRef.current = true;
      writtenRef.current = from;

      if (prefersReducedMotion()) {
        scroller.scrollTop = target;
        writtenRef.current = target;
        glidingRef.current = false;
        frameRef.current = null;
        return;
      }

      const duration = slideDuration(distance);
      const startedAt = performance.now();

      const step = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const offset = from + (target - from) * easeOutSlide(progress);
        scroller.scrollTop = offset;
        writtenRef.current = offset;

        if (progress < 1) {
          frameRef.current = requestAnimationFrame(step);
          return;
        }

        frameRef.current = null;
        glidingRef.current = false;
      };

      frameRef.current = requestAnimationFrame(step);
    },
    [scrollerRef, slideCount],
  );

  const isGliding = useCallback(() => glidingRef.current, []);

  const isOwnOffset = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return true;
    // A hair of tolerance: the browser keeps scroll offsets on device pixels,
    // so the value read back after a write is the written value rounded, not
    // the float that was written.
    return Math.abs(scroller.scrollTop - writtenRef.current) < 1.5;
  }, [scrollerRef]);

  return { glideTo, isGliding, isOwnOffset, stopGlide };
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * A single category slide: nothing but the category image, full-bleed. The
 * heading already lives inside the image, so no overlay is added. The whole
 * slide is the link to that category's products.
 *
 * The slide is `position: sticky; top: 0` and one viewport tall, which is what
 * makes it cover the slide above it instead of being scrolled past it. It is the
 * last of the three things this slide is (the link, the image, the sticky
 * layer) and none of them is JS: the offset the browser is already resolving is
 * the whole animation.
 *
 * Art direction: a category may carry a second, mobile-only image. The
 * boundary is Tailwind's `md` (768px) — the same width the QA harness treats
 * as a tablet viewport. Below it the mobile image wins; a category that never
 * set one keeps showing its desktop image, so a slide is never blank.
 *
 * Only an art-directed category pays for this. Without a distinct mobile image
 * the markup is exactly what it always was: one <Image>, no extra node, no
 * extra request. When there are two, they are switched with CSS rather than a
 * JS media query so the first paint is already correct on the server — no
 * flash, no hydration mismatch. The mobile image stays lazy on purpose: it is
 * `display: none` on tablet/desktop, where a lazy image is never fetched at
 * all, so art-directed categories cost nothing extra there.
 *
 * Quality: 90 on every image here. A category slide is shown edge to edge at
 * full viewport height, which on a large monitor is more pixels of embroidery
 * than any other surface on the site. These images used to be requested at 55,
 * the same step the old thumbnails used, and that — not the upload pipeline —
 * was what read as pixelation; the loss was largest on the very slides that
 * carry the brand. The cost is paid only where it is spent: `sizes="100vw"`
 * means a phone still downloads the 828px candidate, so the bytes on mobile are
 * unchanged.
 */
function CategorySlide({ category, eager }: CategorySlideProps) {
  const desktopOnly = resolveImageUrl(category.image);
  const mobileOnly = resolveImageUrl(category.mobileImage);
  // Symmetric fallback: whichever image exists serves the viewport it fits, so
  // a category with only one of the two is still shown on every screen.
  const mobileImage = mobileOnly ?? desktopOnly;
  const desktopImage = desktopOnly ?? mobileOnly;
  const artDirected = mobileOnly !== null && mobileOnly !== desktopImage;

  return (
    <Link
      href={categoryHref(category.slug)}
      aria-label={category.name}
      className="sticky top-0 block h-[100svh] overflow-hidden bg-sand focus-visible:outline-plum"
    >
      {!desktopImage || !mobileImage ? null : artDirected ? (
        <>
          <Image
            src={mobileImage}
            alt={category.name}
            fill
            sizes="100vw"
            quality={90}
            loading="lazy"
            fetchPriority="low"
            className="object-cover object-center md:hidden"
          />
          <Image
            src={desktopImage}
            alt={category.name}
            fill
            sizes="100vw"
            quality={90}
            {...(eager
              ? { loading: "eager", fetchPriority: "high" }
              : { loading: "lazy", fetchPriority: "low" })}
            className="object-cover object-center hidden md:block"
          />
        </>
      ) : (
        <Image
          src={desktopImage}
          alt={category.name}
          fill
          sizes="100vw"
          quality={90}
          {...(eager
            ? { loading: "eager", fetchPriority: "high" }
            : { loading: "lazy", fetchPriority: "low" })}
          className="object-cover object-center"
        />
      )}
    </Link>
  );
}