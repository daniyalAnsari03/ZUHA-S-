import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnnouncementBar } from "@/components/storefront/announcement-bar";
import { getActiveAnnouncements } from "@/lib/storefront/data";

describe("AnnouncementBar", () => {
  it("renders all active messages in the scrolling ticker", async () => {
    const messages = await getActiveAnnouncements();
    expect(messages.length).toBeGreaterThan(1);

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
    render(<AnnouncementBar announcements={messages} />);

    const container = screen.getByRole("region", { name: "Announcements" });
    const text = container.textContent ?? "";
    expect(text).toContain(messages[0].message);
    expect(text).toContain(messages[messages.length - 1].message);
  });

  it("renders nothing when no announcements are active", () => {
    const { container } = render(
      <AnnouncementBar
        announcements={[{ id: "x", message: "hi", active: false, order: 1, durationMs: 5000 }]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});