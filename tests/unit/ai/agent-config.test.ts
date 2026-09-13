import { describe, expect, it } from "vitest";

import { AI_MODEL, MAX_AGENT_TURNS, TOOL_CALL_LIMIT } from "@/agents/config";
import type { AgentContext } from "@/agents/context";
import { contextActorRole } from "@/agents/context";
import { getEntryAgent, AGENTS, EMPLOYEES } from "@/agents/index";

/**
 * Agent configuration and registry tests.
 *
 * These verify the agent system's structural correctness: configuration
 * values, context utilities, agent registry, and entry-agent routing
 * without invoking the OpenAI API.
 */

describe("AI_MODEL config", () => {
  it("defaults to gpt-5.6-luna", () => {
    // In test env, OPENAI_MODEL is not set, so it uses the default.
    expect(AI_MODEL).toBe("gpt-5.6-luna");
  });
});

describe("loop protection", () => {
  it("has reasonable MAX_AGENT_TURNS", () => {
    expect(MAX_AGENT_TURNS).toBeGreaterThanOrEqual(4);
    expect(MAX_AGENT_TURNS).toBeLessThanOrEqual(20);
  });

  it("has reasonable TOOL_CALL_LIMIT", () => {
    expect(TOOL_CALL_LIMIT).toBeGreaterThanOrEqual(5);
    expect(TOOL_CALL_LIMIT).toBeLessThanOrEqual(50);
  });
});

describe("contextActorRole", () => {
  const base: AgentContext = {
    userId: "u-1",
    role: "admin",
    channel: "admin",
    requestId: "r-1",
  };

  it("returns admin for admin role", () => {
    expect(contextActorRole({ ...base, role: "admin" })).toBe("admin");
  });

  it("returns customer for customer role", () => {
    expect(contextActorRole({ ...base, role: "customer" })).toBe("customer");
  });

  it("returns guest for null role", () => {
    expect(contextActorRole({ ...base, role: null })).toBe("guest");
  });
});

describe("agent registry", () => {
  it("exposes the manager and salesman as top-level agents", () => {
    expect(AGENTS.manager).toBeDefined();
    expect(AGENTS.salesman).toBeDefined();
    expect(AGENTS.manager.name).toBe("manager");
    expect(AGENTS.salesman.name).toBe("salesman");
  });

  it("exposes all 7 employee agents", () => {
    const expected = [
      "product",
      "inventory",
      "order",
      "customer",
      "sales",
      "marketing",
      "support",
    ];
    for (const name of expected) {
      expect(EMPLOYEES).toHaveProperty(name);
      expect(EMPLOYEES[name as keyof typeof EMPLOYEES].name).toBe(name);
    }
  });

  it("has exactly 7 employees", () => {
    expect(Object.keys(EMPLOYEES)).toHaveLength(7);
  });
});

describe("getEntryAgent", () => {
  it("returns the manager for admin channel", () => {
    const agent = getEntryAgent("admin");
    expect(agent.name).toBe("manager");
  });

  it("returns the salesman for salesman channel", () => {
    const agent = getEntryAgent("salesman");
    expect(agent.name).toBe("salesman");
  });
});

describe("agent handoffs", () => {
  it("manager has handoffs to all 7 employees", () => {
    const manager = AGENTS.manager;
    // The SDK stores handoffs as an array of agents.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handoffs = (manager as any).handoffs ?? [];
    expect(handoffs.length).toBe(7);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handoffNames = handoffs.map((a: any) => a.name);
    expect(handoffNames).toContain("product");
    expect(handoffNames).toContain("inventory");
    expect(handoffNames).toContain("order");
    expect(handoffNames).toContain("customer");
    expect(handoffNames).toContain("sales");
    expect(handoffNames).toContain("marketing");
    expect(handoffNames).toContain("support");
  });

  it("salesman has handoff to support", () => {
    const salesman = AGENTS.salesman;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handoffs = (salesman as any).handoffs ?? [];
    expect(handoffs.length).toBe(1);
    expect(handoffs[0].name).toBe("support");
  });
});

describe("agent tools", () => {
  it("product agent has catalog and admin tools", () => {
    const agent = EMPLOYEES.product;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (agent as any).tools ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toContain("list_products");
    expect(toolNames).toContain("get_product");
    expect(toolNames).toContain("create_product");
    expect(toolNames).toContain("update_product");
  });

  it("inventory agent has stock tools", () => {
    const agent = EMPLOYEES.inventory;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (agent as any).tools ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toContain("update_stock");
    expect(toolNames).toContain("list_low_stock_products");
  });

  it("order agent has order tools", () => {
    const agent = EMPLOYEES.order;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (agent as any).tools ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toContain("list_all_orders");
    expect(toolNames).toContain("get_order_detail");
    expect(toolNames).toContain("update_order_status");
  });

  it("customer agent has customer tools", () => {
    const agent = EMPLOYEES.customer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (agent as any).tools ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toContain("list_customers");
    expect(toolNames).toContain("get_customer_detail");
  });

  it("sales agent has analytics tools", () => {
    const agent = EMPLOYEES.sales;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (agent as any).tools ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toContain("get_sales_overview");
  });

  it("marketing agent has text generation tools", () => {
    const agent = EMPLOYEES.marketing;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (agent as any).tools ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toContain("generate_product_marketing_copy");
    expect(toolNames).toContain("generate_social_post");
    expect(toolNames).toContain("generate_ad_copy");
  });

  it("salesman has catalog and own-order tools", () => {
    const agent = AGENTS.salesman;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (agent as any).tools ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toContain("list_products");
    expect(toolNames).toContain("get_product");
    expect(toolNames).toContain("list_my_orders");
    expect(toolNames).toContain("get_my_order");
  });
});
