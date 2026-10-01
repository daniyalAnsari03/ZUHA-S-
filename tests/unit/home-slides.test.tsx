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
 */
function setup({ reduceMotion = false } = {}) {
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
        matches: reduceMotion && query.includes("prefers-reduced-motion"),
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

  return {
    view,
    scroller,
    wheel,
    key,
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

  it("never intercepts touch, so a finger tracks the cover one to one", () => {
    const { view, scroller } = setup();

    const touchstart = new Event("touchstart", { bubbles: true, cancelable: true });
    act(() => {
      scroller.dispatchEvent(touchstart);
    });
    expect(touchstart.defaultPrevented).toBe(false);

    const touchmove = new Event("touchmove", { bubbles: true, cancelable: true });
    act(() => {
      scroller.dispatchEvent(touchmove);
    });
    expect(touchmove.defaultPrevented).toBe(false);
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