import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: { value: "/" } }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname.value,
}));

import { AnnouncementBar } from "@/components/storefront/announcement-bar";
import { getActiveAnnouncements } from "@/lib/storefront/data";

function setPathname(value: string) {
  mocks.pathname.value = value;
}

describe("AnnouncementBar", () => {
  it("renders all active messages in the scrolling ticker", async () => {
    const messages = await getActiveAnnouncements();
    expect(messages.length).toBeGreaterThan(1);

    setPathname("/");
    render(<AnnouncementBar announcements={messages} />);

    const container = screen.getByRole("region", { name: "Announcements" });
    expect(container).toBeInTheDocument();

    const allText = container.textContent ?? "";
    for (const msg of messages) {
      expect(allText).toContain(msg.message);
    }
  });

  it("renders the full ordered sequence of messages", async () => {
    const messages = await getActiveAnnouncements();
    setPathname("/");
    render(<AnnouncementBar announcements={messages} />);

    const container = screen.getByRole("region", { name: "Announcements" });
    const text = container.textContent ?? "";
    expect(text).toContain(messages[0].message);
    expect(text).toContain(messages[messages.length - 1].message);
  });

  it("renders nothing when no announcements are active", () => {
    setPathname("/");
    const { container } = render(
      <AnnouncementBar
        announcements={[
          { id: "x", message: "hi", active: false, order: 1, durationMs: 5000 },
        ]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("overlays the page instead of taking its own strip, with no background", () => {
    setPathname("/");
    render(
      <AnnouncementBar
        announcements={[
          { id: "a", message: "Free delivery", active: true, order: 1, durationMs: 5000 },
        ]}
      />,
    );

    const container = screen.getByRole("region", { name: "Announcements" });
    expect(container.className).toContain("absolute");
    expect(container.className).toContain("top-0");
    expect(container.className).not.toMatch(/(^|\s)bg-/);
    expect(container.className).not.toMatch(/border/);
  });

  it("reads light over the homepage hero and muted elsewhere", async () => {
    const [message] = await getActiveAnnouncements();

    setPathname("/");
    const { unmount } = render(
      <AnnouncementBar announcements={[message]} />,
    );
    expect(
      screen.getByRole("region", { name: "Announcements" }).textContent,
    ).toContain(message.message);
    const homeTone = document.querySelector(".announcement-ticker span");
    expect(homeTone?.className).toContain("text-white");
    unmount();

    setPathname("/shop");
    render(<AnnouncementBar announcements={[message]} />);
    const otherTone = document.querySelector(".announcement-ticker span");
    expect(otherTone?.className).toContain("text-charcoal-muted");
  });
});
