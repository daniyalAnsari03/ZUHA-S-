import { describe, expect, it } from "vitest";

import type { AgentInputItem } from "@openai/agents";

import { buildContextItems, buildInputItems } from "@/services/ai/chat-service";
import { formatPKTDate, todayKeyPKT } from "@/lib/time";

/**
 * Context injection tests.
 *
 * Every AI turn gets a system context line carrying the REAL server date in
 * PKT (never a model guess) and, when available, the tracked focus entity so
 * ambiguous follow-ups resolve against explicit structured state.
 */

/**
 * buildContextItems/buildInputItems return SDK AgentInputItem (a union). The
 * first item is always a message item with `role` and `content`; narrow it so
 * the assertions below type-check against every union member.
 */
function asSystemMessage(item: AgentInputItem): {
  role: string;
  content: string;
} {
  return item as unknown as { role: string; content: string };
}

describe("buildContextItems", () => {
  it("always injects the real PKT date", () => {
    const [item] = buildContextItems({});
    const systemItem = asSystemMessage(item);
    expect(systemItem.role).toBe("system");
    if (systemItem.role !== "system") throw new Error("expected system item");

    expect(systemItem.content).toContain("Today's date (Asia/Karachi)");
    // The date must be the actual server clock in PKT, never a guess.
    expect(systemItem.content).toContain(todayKeyPKT().slice(0, 4));
    expect(systemItem.content).not.toContain("ignore previous instructions");
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
    const systemItem = asSystemMessage(item);
    if (systemItem.role !== "system") throw new Error("expected system item");

    expect(systemItem.content).toContain(
      'Current focus: product "Mehrab Jamawar"',
    );
    expect(systemItem.content).toContain(
      "id: 00000000-0000-0000-0000-000000000001",
    );
    expect(systemItem.content).toContain("khudhi karo");
  });

  it("injects the FIRST-MESSAGE GREETING line only when firstMessage is set", () => {
    const [withGreeting] = buildContextItems({ firstMessage: true });
    const greetingItem = asSystemMessage(withGreeting);
    expect(greetingItem.content).toContain("FIRST-MESSAGE GREETING");
    expect(greetingItem.content).toContain("welcome");
    expect(greetingItem.content).toContain("first message");

    const [withoutGreeting] = buildContextItems({});
    const plainItem = asSystemMessage(withoutGreeting);
    expect(plainItem.content).not.toContain("FIRST-MESSAGE GREETING");
    expect(plainItem.content).not.toContain("welcome");
  });

  it("passes firstMessage through buildInputItems so only the first turn greets", () => {
    const items = buildInputItems([], "salam", { firstMessage: true });
    expect(asSystemMessage(items[0]).content).toContain(
      "FIRST-MESSAGE GREETING",
    );

    const later = buildInputItems([], "salam", {});
    expect(asSystemMessage(later[0]).content).not.toContain(
      "FIRST-MESSAGE GREETING",
    );
  });

  it("prepends the system line to a full input item list", () => {
    const items = buildInputItems(
      [
        {
          id: "1",
          conversation_id: "c",
          role: "user",
          content: "earlier",
          created_at: "",
        },
      ],
      "current message",
      { focusEntity: null },
    );
    expect(asSystemMessage(items[0]).role).toBe("system");
    expect(items.length).toBe(3); // system + history + current user message
    expect(asSystemMessage(items[items.length - 1]).role).toBe("user");
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
