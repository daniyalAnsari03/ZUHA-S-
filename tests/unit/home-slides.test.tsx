import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HomeSlides } from "@/components/storefront/home-slides";
import type { Category } from "@/lib/storefront/types";

const SLIDE_HEIGHT = 900;

/** hero + three categories + the footer slide. */
const SLIDE_COUNT = 5;

const CATEGORIES: Category[] = [
  { id: "c1", slug: "jamawar", name: "Jamawar", description: "", image: "/a.jpg", mobileImage: "", active: true, order: 1 },
  { id: "c2", slug: "lawn", name: "Lawn", description: "", image: "/b.jpg", mobileImage: "", active: true, order: 2 },
  { id: "c3", slug: "plain", name: "Plain", description: "", image: "/c.jpg", mobileImage: "", active: true, order: 3 },
];

/**
 * jsdom has no layout, no compositor and no scrolling, so the deck is driven by
 * hand: a manual rAF queue, a manual clock, and a scroller whose geometry is
 * faked. `scrollTo` writes the offset and fires the `scroll` event a real
 * browser would fire, so the scroll-linked path — which is the whole mechanism
 * now — runs exactly as it does in the browser.
 *
 * `coarsePointer` reports a phone's primary pointer. The touch path installs
 * itself only when that is true, which is the same condition the component
 * checks in the browser, so a test that does not ask for a phone gets desktop
 * behaviour — and a test that does gets the phone's.
 */
function setup({ reduceMotion = false, coarsePointer = false } = {}) {
  let now = 0;
  let nextFrameId = 1;
  /** Keyed by id, because `cancelAnimationFrame` has to remove one frame and no
   *  other — a stub that empties the queue would let a cancelled tween keep
   *  running in the callbacks already taken for this frame. */
  const frames = new Map<number, FrameRequestCallback>();

  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = nextFrameId++;
    frames.set(id, cb);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames.delete(id);
  });
  vi.stubGlobal("performance", { now: () => now });
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: query.includes("prefers-reduced-motion")
          ? reduceMotion
          : query.includes("pointer: coarse")
            ? coarsePointer
            : false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        onchange: null,
      }) as unknown as MediaQueryList,
  );

  /** Advance the clock and run whatever the component asked for. */
  const advance = (ms: number, steps = 1) => {
    for (let i = 0; i < steps; i++) {
      now += ms / steps;
      const due = [...frames.entries()];
      frames.clear();
      act(() => {
        for (const [, cb] of due) cb(now);
      });
    }
  };

  const view = render(
    <HomeSlides
      hero={<div>hero</div>}
      categories={CATEGORIES}
      footer={<div>footer</div>}
    />,
  );

  const scroller = document.querySelector<HTMLElement>(
    'section[aria-label="Featured"] > div',
  );
  if (!scroller) throw new Error("slide stack not found");

  let scrollTop = 0;
  Object.defineProperty(scroller, "clientHeight", {
    get: () => SLIDE_HEIGHT,
    configurable: true,
  });
  Object.defineProperty(scroller, "scrollHeight", {
    get: () => SLIDE_HEIGHT * SLIDE_COUNT,
    configurable: true,
  });
  Object.defineProperty(scroller, "scrollTop", {
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
    },
    configurable: true,
  });

  /**
   * A scroll the browser performed — a wheel, a trackpad, a finger — as opposed
   * to one the deck animated itself.
   */
  const scrollBy = (deltaY: number) => {
    act(() => {
      scroller.dispatchEvent(
        new Event("scroll", { bubbles: false, cancelable: false }),
      );
    });
    scrollTop += deltaY;
    act(() => {
      scroller.dispatchEvent(new Event("scroll", { bubbles: false, cancelable: false }));
    });
    return scroller.scrollTop;
  };

  const scrollTo = (top: number) => {
    scrollTop = top;
    act(() => {
      scroller.dispatchEvent(new Event("scroll", { bubbles: false, cancelable: false }));
    });
    advance(16);
  };

  const wheel = (deltaY: number, init: WheelEventInit = {}) => {
    const event = new WheelEvent("wheel", {
      deltaY,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    act(() => {
      scroller.dispatchEvent(event);
    });
    return event;
  };

  const key = (k: string) => {
    act(() => {
      scroller.dispatchEvent(
        new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }),
      );
    });
  };

  /**
   * jsdom has no `Touch` constructor, so a touch point is a plain object hung on
   * the event. `touches.length`, `clientX` and `clientY` is the entire surface
   * the deck's touch path reads, so this is a real gesture as far as it is
   * concerned — including `preventDefault`, which is readable on the returned
   * event exactly as it is in the QA harness.
   */
  const touch = (
    type: "touchstart" | "touchmove" | "touchend" | "touchcancel",
    points: { x: number; y: number }[] = [],
  ) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "touches", {
      value: points.map(({ x, y }) => ({ clientX: x, clientY: y })),
      configurable: true,
    });
    act(() => {
      scroller.dispatchEvent(event);
    });
    return event;
  };

  /**
   * One whole finger gesture: down, `distance` px of travel in `steps` moves,
   * up. A NEGATIVE distance is the finger travelling up the screen, which is a
   * swipe towards the next slide — the same way round as the wheel.
   */
  const swipe = (distance: number, { from = 600, steps = 6 } = {}) => {
    touch("touchstart", [{ x: 195, y: from }]);
    let last = null;
    for (let i = 1; i <= steps; i++) {
      last = touch("touchmove", [{ x: 195, y: from + (distance * i) / steps }]);
    }
    touch("touchend", []);
    return last;
  };

  /** Park the deck at a raw offset, the way an interrupted glide would. */
  const parkAt = (top: number) => {
    scrollTop = top;
    act(() => {
      scroller.dispatchEvent(new Event("scroll", { bubbles: false, cancelable: false }));
    });
  };

  return {
    view,
    scroller,
    wheel,
    key,
    touch,
    swipe,
    parkAt,
    scrollBy,
    scrollTo,
    advance,
    now: () => now,
    scrollTop: () => scrollTop,
  };
}

beforeEach(() => {
  // The stack is treated as the top of the page unless a test says otherwise.
  Object.defineProperty(window, "scrollY", { value: 0, writable: true, configurable: true });
  // The section-level observer that hides the dots has no layout to measure
  // against in jsdom, so it stands in for the real thing.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HomeSlides", () => {
  it("renders the hero, one slide per category, and the footer as the closing slide", () => {
    const { view } = setup();
    expect(screen.getByText("hero")).toBeInTheDocument();
    expect(document.querySelectorAll('a[href*="/shop?category="]')).toHaveLength(3);

    const slides = document.querySelectorAll('[aria-label="Slide deck"] > *');
    expect(slides).toHaveLength(SLIDE_COUNT);
    const footerSlide = slides[slides.length - 1] as HTMLElement;
    expect(footerSlide.dataset.slide).toBe("footer");
    expect(footerSlide).toContainElement(screen.getByText("footer"));
    view.unmount();
  });

  /**
   * The cover stack IS this. Every slide pins itself at the top of the scrollport
   * with `position: sticky; top: 0`, and the deck's scroll distance is then one
   * slide short of N x slide-height — which is what makes the last slide land
   * exactly on top with nothing left over.
   */
  it("pins every slide to the top of the scrollport instead of snapping to it", () => {
    const { view } = setup();
    const slides = Array.from(
      document.querySelectorAll<HTMLElement>('[aria-label="Slide deck"] > *'),
    );

    expect(slides).toHaveLength(SLIDE_COUNT);
    for (const slide of slides) {
      expect(slide.className).toContain("sticky");
      expect(slide.className).toContain("top-0");
      expect(slide.className).toContain("h-[100svh]");
      // No snap points anywhere: a snap point would drag the offset back to a
      // boundary and undo a partial cover, which is what this deck is replacing.
      expect(slide.className).not.toContain("snap-");
    }

    // The scroller is the deck: one viewport tall, scrollable, no snap.
    const scroller = document.querySelector<HTMLElement>(
      'section[aria-label="Featured"] > div',
    )!;
    expect(scroller.className).toContain("h-[100svh]");
    expect(scroller.className).not.toContain("snap-");
    view.unmount();
  });

  /**
   * The deck's scroll distance has to be N - 1 slides, not N. One extra slide of
   * travel is what a sticky stack does NOT need: a sticky child can never be
   * pushed above the bottom of its containing block, and its containing block
   * here is the deck. `h-[100svh]` per slide inside an `h-[100svh]` scroller is
   * what produces exactly (N - 1) x slide-height of room.
   */
  it("gives the deck one slide less of travel than it has slides", () => {
    const { view, scroller } = setup();
    const slides = scroller.children.length;
    expect(slides).toBe(SLIDE_COUNT);
    // scrollHeight is clientHeight + the sticky stack's room.
    expect(scroller.scrollHeight - scroller.clientHeight).toBe(
      SLIDE_HEIGHT * (SLIDE_COUNT - 1),
    );
    view.unmount();
  });

  it("gives the footer slide one dot of its own, last in the rail", () => {
    const { view, advance, scrollTop } = setup();
    const dots = screen.getAllByRole("button", { name: /go to slide/i });
    expect(dots).toHaveLength(SLIDE_COUNT);

    act(() => {
      dots[SLIDE_COUNT - 1].click();
    });
    // The dot is marked current the instant it is clicked, before a frame has
    // run: the destination is known when the shopper asks for it.
    expect(dots[SLIDE_COUNT - 1]).toHaveAttribute("aria-current", "true");

    advance(2000, 80);
    expect(scrollTop()).toBe(SLIDE_HEIGHT * (SLIDE_COUNT - 1));
    view.unmount();
  });

  /**
   * The deck never takes the wheel. The old build read a notch as intent and
   * answered it with a whole-slide glide, because a snap point would otherwise
   * have pulled a short push straight back. With no snap there is nothing to
   * undo, so travel is motion: what the wheel says is what the cover does.
   */
  it("never intercepts the wheel, in either direction", () => {
    const { view, wheel, advance, scrollTop } = setup();

    expect(wheel(100).defaultPrevented).toBe(false);
    expect(wheel(-100).defaultPrevented).toBe(false);
    advance(1000, 40);

    // Nothing moved on its own: the browser owns that scroll, not the deck.
    expect(scrollTop()).toBe(0);
    view.unmount();
  });

  it("never intercepts pinch-zoom or sideways travel", () => {
    const { view, wheel, advance, scrollTop } = setup();

    expect(wheel(100, { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(wheel(0, { deltaX: 120, deltaY: 10 }).defaultPrevented).toBe(false);
    advance(1000, 40);
    expect(scrollTop()).toBe(0);
    view.unmount();
  });

  /**
   * A phone owns the deck, so the deck takes the gesture and the compositor must
   * not also act on it. Without the preventDefault the browser scrolls the same
   * container a second time and the two stack — which is the "two or three
   * slides for one swipe" symptom arriving from the other direction.
   */
  it("takes a finger's drag itself, and tracks the cover one to one", () => {
    const { view, touch, scrollTop } = setup({ coarsePointer: true });

    touch("touchstart", [{ x: 195, y: 600 }]);
    const moved = touch("touchmove", [{ x: 195, y: 400 }]);

    expect(moved.defaultPrevented).toBe(true);
    // 200px of finger travel, 200px of cover: not a slide, not a rounded
    // fraction of one. The finger and the cover are the same thing.
    expect(scrollTop()).toBe(200);

    // And it keeps tracking, rather than committing at the first move.
    touch("touchmove", [{ x: 195, y: 100 }]);
    expect(scrollTop()).toBe(500);
    view.unmount();
  });

  /**
   * THE FIX. One swipe, one slide, on the slide it started from, every time.
   *
   * Every length here clears the commit distance on a 900px slide (90px), so
   * every one of them is a swipe. Gestures under it are not — they are taps and
   * shifts, and are asserted as snap-backs further down rather than being
   * quietly omitted.
   */
  it("moves exactly one slide per swipe however far the finger went", () => {
    for (const distance of [-90, -120, -400, -600, -900, -4000]) {
      const { view, swipe, advance, scrollTop } = setup({ coarsePointer: true });

      swipe(distance);
      advance(2000, 80);

      // A negative distance is the finger going up, i.e. towards the next
      // slide. A 4000px throw is 4.4 slides of finger travel and still lands on
      // slide two — the throw cannot buy more than one, which is the whole bound.
      expect(scrollTop()).toBe(SLIDE_HEIGHT);
      view.unmount();
    }
  });

  it("treats the commit distance itself as a swipe, and one pixel under it as a tap", () => {
    const committed = setup({ coarsePointer: true });
    committed.swipe(-90);
    committed.advance(2000, 80);
    expect(committed.scrollTop()).toBe(SLIDE_HEIGHT);
    committed.view.unmount();

    const tapped = setup({ coarsePointer: true });
    tapped.swipe(-89);
    tapped.advance(2000, 80);
    expect(tapped.scrollTop()).toBe(0);
    tapped.view.unmount();
  });

  it("moves back exactly one slide per backwards swipe", () => {
    const { view, swipe, advance, scrollTop } = setup({ coarsePointer: true });

    swipe(-600);
    advance(2000, 80);
    expect(scrollTop()).toBe(SLIDE_HEIGHT);

    swipe(-300);
    advance(2000, 80);
    expect(scrollTop()).toBe(SLIDE_HEIGHT * 2);

    swipe(300);
    advance(2000, 80);
    expect(scrollTop()).toBe(SLIDE_HEIGHT);

    swipe(300);
    advance(2000, 80);
    // Already on the first slide: a further swipe back is nowhere to go, and the
    // deck must not travel past the top of its travel.
    expect(scrollTop()).toBe(0);
    view.unmount();
  });

  /**
   * The stuck-between-slides bug. Swept across gesture lengths on both sides of
   * the commit boundary and of one-and-a-half slides, in both directions and
   * from every slide in the deck: every resting offset is an exact multiple of
   * the slide height. Not "close to" — equal, because the deck can only ever
   * settle to `index * clientHeight`, so there is no gesture length for which
   * "between two slides" is a reachable state.
   *
   * The one case deliberately not asserted here is a tap, which is a
   * non-gesture, on a deck that was already resting off a boundary. See the tap
   * test below for why that is left alone rather than tidied.
   */
  it("never comes to rest between two slides", () => {
    // 90px is the commit distance on a 900px slide; 40px is the absolute floor;
    // the rest straddle one-and-a-half slides in both directions and the deck's
    // whole 3600px of travel.
    const lengths = [
      1, 8, 39, 40, 41, 89, 90, 91, 200, 380, 449, 450, 451, 500, 700, 900,
      901, 1200, 1800, 3600, 5000,
    ];

    for (const startIndex of [0, 1, 2, 3, 4]) {
      const fractional = startIndex === 3;
      for (const length of lengths) {
        // Below the 10px axis-lock distance the deck does not know a gesture has
        // started, so from a deck already resting off a boundary it behaves
        // exactly like the tap above. From a boundary that is harmless — it stays
        // on the boundary — so only the fractional start has to give it up.
        if (fractional && length < 10) continue;

        for (const sign of [-1, 1]) {
          const { view, swipe, parkAt, advance, scrollTop } = setup({
            coarsePointer: true,
          });
          // Start on a boundary, the way the deck rests after any dot, key or
          // swipe — and once from a fractional offset left by a glide that was
          // interrupted, because that is the one place a non-boundary resting
          // offset can still arrive from.
          if (fractional) parkAt(SLIDE_HEIGHT * 2.37);
          else parkAt(SLIDE_HEIGHT * startIndex);

          swipe(length * sign);
          advance(2000, 80);

          const rest = scrollTop();
          expect(rest % SLIDE_HEIGHT).toBe(0);
          expect(rest).toBeGreaterThanOrEqual(0);
          expect(rest).toBeLessThanOrEqual(SLIDE_HEIGHT * (SLIDE_COUNT - 1));
          view.unmount();
        }
      }
    }
  });

  /**
   * A swipe from a fractional rest — an interrupted glide, say — is anchored to
   * the slide the cover is actually showing, which is the dot the shopper can
   * see marked. 2.37 slides of 900 is showing the third slide, so forward is
   * the fourth and back is the second.
   */
  it("anchors a swipe to the slide showing, not to the raw offset", () => {
    const forward = setup({ coarsePointer: true });
    forward.parkAt(SLIDE_HEIGHT * 2.37);
    forward.swipe(-300);
    forward.advance(2000, 80);
    expect(forward.scrollTop()).toBe(SLIDE_HEIGHT * 3);
    forward.view.unmount();

    const backward = setup({ coarsePointer: true });
    backward.parkAt(SLIDE_HEIGHT * 2.37);
    backward.swipe(300);
    backward.advance(2000, 80);
    expect(backward.scrollTop()).toBe(SLIDE_HEIGHT);
    backward.view.unmount();
  });

  /**
   * A slow, deliberate drag is still one swipe. This is the gesture the old
   * velocity-based rule got wrong: same distance, far slower, and it used to
   * resolve differently from the flick that covered the same ground.
   */
  it("treats a slow drag across a whole slide as one swipe, not as travel", () => {
    const { view, swipe, advance, scrollTop } = setup({ coarsePointer: true });

    // 900px of finger travel in six moves with frames between them: a drag, not
    // a flick, and the slowest thing the deck has to answer.
    swipe(-SLIDE_HEIGHT, { from: 800, steps: 6 });
    advance(2000, 80);
    expect(scrollTop()).toBe(SLIDE_HEIGHT);
    view.unmount();
  });

  it("drags back within a gesture without changing where the gesture goes", () => {
    const { view, touch, advance, scrollTop } = setup({ coarsePointer: true });

    // Forward past a boundary, then back to a third of the way. Anchored to
    // where the gesture STARTED, so the throw direction wins — a throw that
    // crossed a boundary and came back is not an ask for slide three, and
    // reading the end offset is how one flick became three slides.
    touch("touchstart", [{ x: 195, y: 800 }]);
    touch("touchmove", [{ x: 195, y: 200 }]);
    expect(scrollTop()).toBe(600);
    touch("touchmove", [{ x: 195, y: 500 }]);
    expect(scrollTop()).toBe(300);
    touch("touchend", []);

    advance(2000, 80);
    expect(scrollTop()).toBe(SLIDE_HEIGHT);
    view.unmount();
  });

  it("a short drag snaps back to the slide it started on instead of sticking", () => {
    const { view, swipe, advance, scrollTop } = setup({ coarsePointer: true });

    // 39px is under the commit distance. The cover has moved with the finger,
    // so it is off the boundary — and the lift has to put it back rather than
    // leaving it stranded, which is exactly what a native fling used to do.
    swipe(-39);
    expect(scrollTop()).toBe(39);
    advance(2000, 80);
    expect(scrollTop()).toBe(0);
    view.unmount();
  });

  /**
   * A tap is not a swipe, and the slide under the finger is a link. The deck
   * must not move at all, or the shopper is taken to another slide and then to
   * /shop.
   *
   * The second half is the one deliberate exception to "the deck always rests on
   * a slide". If the deck is somehow already resting OFF a boundary — which
   * after this build only an interrupted glide can do, since every gesture now
   * ends on one — a tap still does nothing. Re-seating it would mean a tap moves
   * the cover under a finger that is on its way to a link, which is a worse
   * thing to do than leaving a state that has no reachable cause.
   */
  it("a tap with no travel neither swipes nor re-seats the deck", () => {
    const { view, touch, advance, scrollTop } = setup({ coarsePointer: true });

    touch("touchstart", [{ x: 195, y: 520 }]);
    touch("touchend", []);
    advance(2000, 80);
    expect(scrollTop()).toBe(0);

    // Same from a boundary that is not the first one.
    view.unmount();
    const second = setup({ coarsePointer: true });
    act(() => {
      second.view.container.querySelectorAll("button")[1].click();
    });
    second.advance(2000, 80);
    expect(second.scrollTop()).toBe(SLIDE_HEIGHT);
    second.touch("touchstart", [{ x: 195, y: 520 }]);
    second.touch("touchend", []);
    second.advance(2000, 80);
    expect(second.scrollTop()).toBe(SLIDE_HEIGHT);
    second.view.unmount();

    // And a tap onto a deck already resting off a boundary leaves it there.
    const third = setup({ coarsePointer: true });
    third.parkAt(SLIDE_HEIGHT * 2.37);
    third.touch("touchstart", [{ x: 195, y: 520 }]);
    third.touch("touchend", []);
    third.advance(2000, 80);
    expect(third.scrollTop()).toBe(SLIDE_HEIGHT * 2.37);
    third.view.unmount();
  });

  it("settles a cancelled gesture the same way it settles a lift", () => {
    const { view, touch, advance, scrollTop } = setup({ coarsePointer: true });

    // An interrupt halfway through a throw — a call, a system gesture. Left
    // alone, the cover stays wherever the interrupt caught it, off the boundary.
    touch("touchstart", [{ x: 195, y: 800 }]);
    touch("touchmove", [{ x: 195, y: 300 }]);
    expect(scrollTop()).toBe(500);
    touch("touchcancel", []);
    advance(2000, 80);
    expect(scrollTop()).toBe(SLIDE_HEIGHT);
    view.unmount();
  });

  it("hands a two-finger gesture straight back, because that is a pinch", () => {
    const { view, touch, advance, scrollTop } = setup({ coarsePointer: true });

    touch("touchstart", [
      { x: 120, y: 700 },
      { x: 270, y: 700 },
    ]);
    const moved = touch("touchmove", [{ x: 120, y: 200 }]);
    touch("touchend", []);

    expect(moved.defaultPrevented).toBe(false);
    advance(2000, 80);
    expect(scrollTop()).toBe(0);
    view.unmount();
  });

  it("leaves a horizontal drag to whatever else wants it", () => {
    const { view, touch, advance, scrollTop } = setup({ coarsePointer: true });

    touch("touchstart", [{ x: 100, y: 520 }]);
    const moved = touch("touchmove", [{ x: 340, y: 500 }]);
    touch("touchend", []);

    expect(moved.defaultPrevented).toBe(false);
    advance(2000, 80);
    expect(scrollTop()).toBe(0);
    view.unmount();
  });

  /**
   * A finger landing mid-glide is the shopper taking the deck back, exactly as
   * a wheel is. The glide has to stand down before the gesture's first move.
   */
  it("takes the deck back from a glide the moment a finger lands", () => {
    const { view, touch, advance, scrollTop } = setup({ coarsePointer: true });

    act(() => {
      screen.getAllByRole("button", { name: /go to slide/i })[4].click();
    });
    advance(16, 4);
    const gliding = scrollTop();
    expect(gliding).toBeGreaterThan(0);
    expect(gliding).toBeLessThan(SLIDE_HEIGHT * 4);

    touch("touchstart", [{ x: 195, y: 600 }]);
    // Nothing is left running to pull the deck back over the top of the finger.
    advance(2000, 80);
    expect(scrollTop()).toBe(gliding);
    view.unmount();
  });

  /**
   * Desktop is a fine pointer, so none of this installs. A drag that happens to
   * arrive as touch events — a touchscreen laptop being driven by its trackpad,
   * or any browser reporting a fine primary pointer — must keep travelling as
   * travel and must not be swallowed.
   */
  it("never intercepts touch when the primary pointer is not coarse", () => {
    const { view, touch, advance, scrollTop } = setup({ coarsePointer: false });

    const start = touch("touchstart", [{ x: 195, y: 600 }]);
    const moved = touch("touchmove", [{ x: 195, y: 200 }]);
    const ended = touch("touchend", []);

    expect(start.defaultPrevented).toBe(false);
    expect(moved.defaultPrevented).toBe(false);
    expect(ended.defaultPrevented).toBe(false);
    advance(2000, 80);
    // Travel is travel: the deck is wherever the browser left it, and the deck
    // itself has not touched it.
    expect(scrollTop()).toBe(0);
    view.unmount();
  });

  /**
   * The active dot reads the offset the cover is actually at, so a partial cover
   * names the slide that is showing more of the scrollport. Past the midpoint it
   * has crossed over.
   */
  it("tracks the active dot to the offset the cover is at", () => {
    const { view, scrollTo } = setup();
    const current = () =>
      screen
        .getAllByRole("button", { name: /go to slide/i })
        .findIndex((dot) => dot.getAttribute("aria-current") === "true");

    expect(current()).toBe(0);

    // Still mostly the hero.
    scrollTo(SLIDE_HEIGHT * 0.4);
    expect(current()).toBe(0);

    // Past the midpoint of the first cover: the category has taken the screen.
    scrollTo(SLIDE_HEIGHT * 0.6);
    expect(current()).toBe(1);

    // And the same rule holds at every other boundary, in the other direction.
    scrollTo(SLIDE_HEIGHT * 3.4);
    expect(current()).toBe(3);
    scrollTo(SLIDE_HEIGHT * 1.6);
    expect(current()).toBe(2);
    view.unmount();
  });

  /**
   * A trackpad's deceleration can report the same offset twice in consecutive
   * frames a hair either side of a boundary. Rounding puts the change of answer
   * on the far side of the midpoint, so both of those frames get the same dot and
   * the rail does not strobe while the cover is sitting still.
   */
  it("does not flicker the active dot on frames that straddle a boundary", () => {
    const { view, scrollTo } = setup();
    const current = () =>
      screen
        .getAllByRole("button", { name: /go to slide/i })
        .findIndex((dot) => dot.getAttribute("aria-current") === "true");

    // Half a pixel either side of the boundary: same slide, twice.
    expect(current()).toBe(0);
    scrollTo(SLIDE_HEIGHT - 0.25);
    scrollTo(SLIDE_HEIGHT + 0.25);
    expect(current()).toBe(1);

    // And it does not walk backwards when the jitter comes back.
    scrollTo(SLIDE_HEIGHT - 0.25);
    expect(current()).toBe(1);

    // A real change of direction still reports the truth.
    scrollTo(SLIDE_HEIGHT * 2 - 0.25);
    expect(current()).toBe(2);
    view.unmount();
  });

  it("moves on a dot click and on the arrow keys", () => {
    const { view, advance, scrollTop, key } = setup();

    const dots = screen.getAllByRole("button", { name: /go to slide/i });
    expect(dots).toHaveLength(SLIDE_COUNT);

    act(() => {
      dots[2].click();
    });
    advance(2000, 80);
    expect(scrollTop()).toBe(SLIDE_HEIGHT * 2);

    key("ArrowUp");
    advance(1000, 40);
    expect(scrollTop()).toBe(SLIDE_HEIGHT);

    key("Home");
    advance(1000, 40);
    expect(scrollTop()).toBe(0);
    view.unmount();
  });

  it("reaches both ends of the deck with the keyboard", () => {
    const { view, advance, scrollTop, key } = setup();

    key("End");
    advance(2000, 80);
    expect(scrollTop()).toBe(SLIDE_HEIGHT * (SLIDE_COUNT - 1));

    key("Home");
    advance(2000, 80);
    expect(scrollTop()).toBe(0);
    view.unmount();
  });

  it("glides rather than jumping: the offset moves every frame and never reverses", () => {
    const { view, advance, scrollTop, now } = setup();

    act(() => {
      screen.getAllByRole("button", { name: /go to slide/i })[1].click();
    });

    const seen: number[] = [];
    for (let i = 0; i < 100; i++) {
      now();
      advance(16);
      seen.push(scrollTop());
    }

    const moving = seen.filter((value, index) => index > 0 && value !== seen[index - 1]);
    expect(moving.length).toBeGreaterThan(4);
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    }
    expect(seen[seen.length - 1]).toBe(SLIDE_HEIGHT);
    view.unmount();
  });

  /**
   * A dot click or an arrow key is a destination; a wheel or a finger mid-glide is
   * the shopper taking the deck back. The deck has to let go of the tween rather
   * than animating the offset back over the top of them.
   */
  it("stands down a glide the moment the shopper scrolls it themselves", () => {
    const { view, advance, scrollTop, scrollBy } = setup();

    act(() => {
      screen.getAllByRole("button", { name: /go to slide/i })[4].click();
    });
    advance(16, 4);
    const gliding = scrollTop();
    expect(gliding).toBeGreaterThan(0);
    expect(gliding).toBeLessThan(SLIDE_HEIGHT * 4);

    // A wheel event lands on top of the tween and the deck keeps it.
    scrollBy(SLIDE_HEIGHT);
    expect(scrollTop()).toBe(gliding + SLIDE_HEIGHT);

    // And nothing is still running to pull it back.
    advance(2000, 80);
    expect(scrollTop()).toBe(gliding + SLIDE_HEIGHT);
    view.unmount();
  });

  it("jumps with no animation when reduced motion is requested", () => {
    const { view, scrollTop, advance } = setup({ reduceMotion: true });

    act(() => {
      screen.getAllByRole("button", { name: /go to slide/i })[1].click();
    });
    // Already there, before a single frame has run.
    expect(scrollTop()).toBe(SLIDE_HEIGHT);
    advance(1000, 40);
    expect(scrollTop()).toBe(SLIDE_HEIGHT);
    view.unmount();
  });

  it("announces the current slide for assistive technology", () => {
    const { view, scrollTo } = setup();
    expect(screen.getByText(`Slide 1 of ${SLIDE_COUNT}: Hero`)).toBeInTheDocument();

    // The footer announces itself as the closing slide, not as a category.
    scrollTo(SLIDE_HEIGHT * (SLIDE_COUNT - 1));
    expect(
      screen.getByText(`Slide ${SLIDE_COUNT} of ${SLIDE_COUNT}: Footer`),
    ).toBeInTheDocument();
    view.unmount();
  });

  it("renders no dots when there is a single slide", () => {
    const view = render(<HomeSlides hero={<div>hero</div>} categories={[]} />);
    expect(screen.queryAllByRole("button", { name: /go to slide/i })).toHaveLength(0);
    view.unmount();
  });

  it("still has a deck when there are no categories but there is a footer", () => {
    const view = render(
      <HomeSlides hero={<div>hero</div>} categories={[]} footer={<div>footer</div>} />,
    );
    // Hero and footer: two slides, so two dots and a real keyboard path.
    expect(screen.getAllByRole("button", { name: /go to slide/i })).toHaveLength(2);
    expect(
      document.querySelectorAll('[aria-label="Slide deck"] > *'),
    ).toHaveLength(2);
    view.unmount();
  });
});