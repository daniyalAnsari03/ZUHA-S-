import { describe, expect, it } from "vitest";

import { AI_MODEL } from "@/agents/config";
import type { AgentContext } from "@/agents/context";
import { contextActorRole } from "@/agents/context";
import { getEntryAgent, AGENTS, EMPLOYEES } from "@/agents/index";

/**
 * Comprehensive agent routing and tool assignment tests.
 *
 * Verify that every agent has the correct tools, handoffs work properly,
 * and the manager routes to the correct employee for different request types.
 */

describe("Agent tool assignments — comprehensive", () => {
  it("sales agent has get_sales_overview for sales queries", () => {
    const agent = EMPLOYEES.sales;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (agent as any).tools ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toContain("get_sales_overview");
    expect(toolNames).toContain("list_products");
    expect(toolNames).toContain("list_all_orders");
    expect(toolNames).toContain("list_low_stock_products");
  });

  it("product agent has all catalog tools for product queries", () => {
    const agent = EMPLOYEES.product;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (agent as any).tools ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toContain("list_products");
    expect(toolNames).toContain("get_product");
    expect(toolNames).toContain("list_categories");
    expect(toolNames).toContain("resolve_category");
    expect(toolNames).toContain("create_product");
    expect(toolNames).toContain("update_product");
    expect(toolNames).toContain("set_product_active");
    expect(toolNames).toContain("delete_product");
    expect(toolNames).toContain("get_cms_content");
  });

  it("inventory agent has stock management tools", () => {
    const agent = EMPLOYEES.inventory;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (agent as any).tools ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toContain("update_stock");
    expect(toolNames).toContain("list_low_stock_products");
    expect(toolNames).toContain("list_products");
    expect(toolNames).toContain("get_product");
  });

  it("order agent has order management tools", () => {
    const agent = EMPLOYEES.order;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (agent as any).tools ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toContain("list_all_orders");
    expect(toolNames).toContain("get_order_detail");
    expect(toolNames).toContain("update_order_status");
    expect(toolNames).toContain("get_cms_content");
  });

  it("customer agent has customer lookup tools", () => {
    const agent = EMPLOYEES.customer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (agent as any).tools ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toContain("list_customers");
    expect(toolNames).toContain("get_customer_detail");
  });

  it("marketing agent has copy generation tools", () => {
    const agent = EMPLOYEES.marketing;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (agent as any).tools ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toContain("generate_product_marketing_copy");
    expect(toolNames).toContain("generate_social_post");
    expect(toolNames).toContain("generate_ad_copy");
    expect(toolNames).toContain("get_sales_overview");
    expect(toolNames).toContain("list_products");
  });

  it("support agent has read-only support tools", () => {
    const agent = EMPLOYEES.support;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (agent as any).tools ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toContain("list_customers");
    expect(toolNames).toContain("get_customer_detail");
    expect(toolNames).toContain("list_all_orders");
    expect(toolNames).toContain("get_order_detail");
    expect(toolNames).toContain("list_products");
    expect(toolNames).toContain("get_product");
    expect(toolNames).toContain("get_cms_content");
    expect(toolNames).toContain("check_availability");
  });

  it("salesman has storefront tools only", () => {
    const agent = AGENTS.salesman;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (agent as any).tools ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolNames = tools.map((t: any) => t.name);
    // Should have catalog and own-order tools
    expect(toolNames).toContain("list_categories");
    expect(toolNames).toContain("list_products");
    expect(toolNames).toContain("get_product");
    expect(toolNames).toContain("check_availability");
    expect(toolNames).toContain("get_cms_content");
    expect(toolNames).toContain("list_my_orders");
    expect(toolNames).toContain("get_my_order");
    // Should NOT have admin tools
    expect(toolNames).not.toContain("create_product");
    expect(toolNames).not.toContain("delete_product");
    expect(toolNames).not.toContain("list_all_orders");
    expect(toolNames).not.toContain("update_order_status");
    expect(toolNames).not.toContain("list_customers");
    expect(toolNames).not.toContain("get_sales_overview");
    expect(toolNames).not.toContain("update_stock");
  });
});

describe("Manager routing — request classification", () => {
  it("manager has handoffs to all 7 employees", () => {
    const manager = AGENTS.manager;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handoffs = (manager as any).handoffs ?? [];
    expect(handoffs.length).toBe(7);
  });

  it("all 7 employee names are reachable via handoff", () => {
    const manager = AGENTS.manager;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handoffs = (manager as any).handoffs ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handoffNames = handoffs.map((a: any) => a.name);
    const expectedEmployees = [
      "product",
      "inventory",
      "order",
      "customer",
      "sales",
      "marketing",
      "support",
    ];
    for (const name of expectedEmployees) {
      expect(handoffNames).toContain(name);
    }
  });

  it("salesman has handoff only to support", () => {
    const salesman = AGENTS.salesman;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handoffs = (salesman as any).handoffs ?? [];
    expect(handoffs.length).toBe(1);
    expect(handoffs[0].name).toBe("support");
  });
});

describe("Context and role system", () => {
  it("contextActorRole maps admin correctly", () => {
    const ctx: AgentContext = {
      userId: "u-1",
      role: "admin",
      channel: "admin",
      requestId: "r-1",
    };
    expect(contextActorRole(ctx)).toBe("admin");
  });

  it("contextActorRole maps customer correctly", () => {
    const ctx: AgentContext = {
      userId: "u-2",
      role: "customer",
      channel: "salesman",
      requestId: "r-2",
    };
    expect(contextActorRole(ctx)).toBe("customer");
  });

  it("contextActorRole maps guest correctly", () => {
    const ctx: AgentContext = {
      userId: null,
      role: null,
      channel: "salesman",
      requestId: "r-3",
    };
    expect(contextActorRole(ctx)).toBe("guest");
  });

  it("getEntryAgent returns manager for admin", () => {
    expect(getEntryAgent("admin").name).toBe("manager");
  });

  it("getEntryAgent returns salesman for salesman", () => {
    expect(getEntryAgent("salesman").name).toBe("salesman");
  });
});

describe("AI configuration", () => {
  it("model is configured", () => {
    expect(AI_MODEL).toBeTruthy();
    expect(typeof AI_MODEL).toBe("string");
  });

  it("model matches expected default", () => {
    expect(AI_MODEL).toBe("gpt-5.6-luna");
  });
});

describe("No tool leaks across boundaries", () => {
  it("customer-facing salesman cannot access admin analytics", () => {
    const agent = AGENTS.salesman;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (agent as any).tools ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).not.toContain("get_sales_overview");
    expect(toolNames).not.toContain("list_all_orders");
    expect(toolNames).not.toContain("list_customers");
    expect(toolNames).not.toContain("get_customer_detail");
    expect(toolNames).not.toContain("update_stock");
    expect(toolNames).not.toContain("create_product");
    expect(toolNames).not.toContain("delete_product");
  });

  it("support agent has no mutation tools", () => {
    const agent = EMPLOYEES.support;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (agent as any).tools ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).not.toContain("create_product");
    expect(toolNames).not.toContain("update_product");
    expect(toolNames).not.toContain("delete_product");
    expect(toolNames).not.toContain("update_stock");
    expect(toolNames).not.toContain("update_order_status");
  });
});
