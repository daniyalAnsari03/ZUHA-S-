import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnnouncementBar } from "@/components/storefront/announcement-bar";
import { getActiveAnnouncements } from "@/lib/storefront/data";

describe("AnnouncementBar", () => {
  it("renders exactly one message at a time", () => {
    const messages = getActiveAnnouncements();
    expect(messages.length).toBeGreaterThan(1);

    render(<AnnouncementBar announcements={messages} />);

    const visible = messages.filter((m) =>
      screen.queryByText(m.message),
    );
    expect(visible).toHaveLength(1);
  });

  it("renders the first ordered message initially", () => {
    const messages = getActiveAnnouncements();
    render(<AnnouncementBar announcements={messages} />);
    expect(screen.getByText(messages[0].message)).toBeInTheDocument();
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