import { describe, expect, it } from "vitest";

import { buildContextItems, buildInputItems } from "@/services/ai/chat-service";
import { formatPKTDate, todayKeyPKT } from "@/lib/time";

/**
 * Context injection tests.
 *
 * Every AI turn gets a system context line carrying the REAL server date in
 * PKT (never a model guess) and, when available, the tracked focus entity so
 * ambiguous follow-ups resolve against explicit structured state.
 */
describe("buildContextItems", () => {
  it("always injects the real PKT date", () => {
    const [item] = buildContextItems({});
    expect(item.role).toBe("system");
    if (item.role !== "system") throw new Error("expected system item");

    expect(item.content).toContain("Today's date (Asia/Karachi)");
    // The date must be the actual server clock in PKT, never a guess.
    expect(item.content).toContain(todayKeyPKT().slice(0, 4));
    expect(item.content).not.toContain("ignore previous instructions");
  });

  it("states the focus entity when present", () => {
    const [item] = buildContextItems({
      focusEntity: {
        type: "product",
        id: "00000000-0000-0000-0000-000000000001",
        name: "Mehrab Jamawar",
        at: "2026-09-12T00:00:00.000Z",
      },
    });
    if (item.role !== "system") throw new Error("expected system item");

    expect(item.content).toContain("Current focus: product \"Mehrab Jamawar\"");
    expect(item.content).toContain("id: 00000000-0000-0000-0000-000000000001");
    expect(item.content).toContain("khudhi karo");
  });

  it("prepends the system line to a full input item list", () => {
    const items = buildInputItems(
      [
        { id: "1", conversation_id: "c", role: "user", content: "earlier", created_at: "" },
      ],
      "current message",
      { focusEntity: null },
    );
    expect(items[0].role).toBe("system");
    expect(items.length).toBe(3); // system + history + current user message
    expect(items[items.length - 1].role).toBe("user");
  });
});

describe("formatPKTDate", () => {
  it("produces a human-readable date from the server clock", () => {
    const label = formatPKTDate();
    expect(label).toMatch(/\w+, \d{1,2} \w+ \d{4}/);
    // Must agree with the same-day PKT key we already trust.
    const parsedYear = label.split(" ").pop();
    expect(parsedYear).toBe(todayKeyPKT().slice(0, 4));
  });
});