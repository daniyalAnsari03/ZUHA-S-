import { describe, expect, it } from "vitest";

import type { AgentContext } from "@/agents/context";
import {
  ADMIN_ROLE,
  checkRole,
  CUSTOMER_ROLE,
  isAdmin,
  toolRoleGuardrail,
  type AgentRole,
} from "@/guardians/authorization";

/**
 * Authorization guardrail tests.
 *
 * Roles and tool access are enforced fail-closed: unauthenticated callers and
 * role mismatches are rejected before any tool executes. The SDK-level
 * `toolRoleGuardrail` is exercised directly with a reduced run context to
 * prove both rejection and agent-name attribution.
 */

function contextWith(
  overrides: Partial<AgentContext> = {},
): {
  ctx: AgentContext;
  runContext: {
    context: AgentContext;
    externalData: Record<string, never>;
  };
} {
  const ctx: AgentContext = {
    userId: "u-admin",
    role: "admin",
    channel: "admin",
    requestId: "req-1",
    conversationId: "conv-1",
    ...overrides,
  };
  return {
    ctx,
    runContext: { context: ctx, externalData: {} },
  };
}

describe("checkRole", () => {
  it("allows an admin for admin-scoped actions", () => {
    const { ctx } = contextWith({ role: "admin" });
    expect(checkRole(ctx, [ADMIN_ROLE])).toEqual({ ok: true, role: "admin" });
  });

  it("allows a customer for customer-scoped actions", () => {
    const { ctx } = contextWith({ role: "customer" });
    expect(checkRole(ctx, [CUSTOMER_ROLE])).toEqual({ ok: true, role: "customer" });
  });

  it("rejects a customer for admin-only actions", () => {
    const { ctx } = contextWith({ role: "customer" });
    const result = checkRole(ctx, [ADMIN_ROLE]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/admin/);
    }
  });

  it("rejects a guest (no role) for every privileged action", () => {
    const { ctx } = contextWith({ role: null });
    expect(checkRole(ctx, [ADMIN_ROLE]).ok).toBe(false);
    expect(checkRole(ctx, [CUSTOMER_ROLE]).ok).toBe(false);
  });

  it("treats an unknown role as unauthorized", () => {
    const { ctx } = contextWith({ role: "superuser" as AgentRole });
    expect(checkRole(ctx, [ADMIN_ROLE]).ok).toBe(false);
    expect(checkRole(ctx, [CUSTOMER_ROLE]).ok).toBe(false);
  });
});

describe("isAdmin", () => {
  it("true only for the admin role", () => {
    expect(isAdmin(contextWith({ role: "admin" }).ctx)).toBe(true);
    expect(isAdmin(contextWith({ role: "customer" }).ctx)).toBe(false);
    expect(isAdmin(contextWith({ role: null }).ctx)).toBe(false);
  });
});

describe("toolRoleGuardrail", () => {
  it("stamps the invoking agent name into the shared context", async () => {
    const { ctx, runContext } = contextWith({ role: "admin" });
    const guardrail = toolRoleGuardrail("update_stock", [ADMIN_ROLE]);
    const result = await guardrail.run({
      context: runContext as unknown as Parameters<typeof guardrail.run>[0]["context"],
      agent: { name: "ai_manager" } as unknown as Parameters<typeof guardrail.run>[0]["agent"],
      toolCall: {
        id: "tc-1",
        type: "function_call",
        callId: "tc-1",
        name: "update_stock",
        arguments: "{}",
      } as unknown as Parameters<typeof guardrail.run>[0]["toolCall"],
    });
    expect(result.behavior.type).toBe("allow");
    expect(ctx.agentName).toBe("ai_manager");
  });

  it("rejects a customer calling an admin-only tool without executing", async () => {
    const { runContext } = contextWith({ role: "customer" });
    const guardrail = toolRoleGuardrail("delete_product", [ADMIN_ROLE]);
    const result = await guardrail.run({
      context: runContext as unknown as Parameters<typeof guardrail.run>[0]["context"],
      agent: { name: "product_agent" } as unknown as Parameters<typeof guardrail.run>[0]["agent"],
      toolCall: {
        id: "tc-2",
        type: "function_call",
        callId: "tc-2",
        name: "delete_product",
        arguments: "{}",
      } as unknown as Parameters<typeof guardrail.run>[0]["toolCall"],
    });
    expect(result.behavior.type).toBe("rejectContent");
    if (result.behavior.type === "rejectContent") {
      expect(result.behavior.message).toMatch(/admin/);
    }
  });

  it("rejects guests even for read-level customer tools when locked", async () => {
    const { runContext } = contextWith({ role: null });
    const guardrail = toolRoleGuardrail("list_my_orders", [CUSTOMER_ROLE]);
    const result = await guardrail.run({
      context: runContext as unknown as Parameters<typeof guardrail.run>[0]["context"],
      agent: { name: "order_agent" } as unknown as Parameters<typeof guardrail.run>[0]["agent"],
      toolCall: {
        id: "tc-3",
        type: "function_call",
        callId: "tc-3",
        name: "list_my_orders",
        arguments: "{}",
      } as unknown as Parameters<typeof guardrail.run>[0]["toolCall"],
    });
    expect(result.behavior.type).toBe("rejectContent");
  });
});