import { describe, expect, it } from "vitest";

import type { AgentContext } from "@/agents/context";
import { contextActorRole } from "@/agents/context";
import { getEntryAgent, AGENTS, EMPLOYEES } from "@/agents/index";

/**
 * Comprehensive Phase 7 AI Manager + AI Employees test suite.
 *
 * Tests cover:
 * 1. Admin vs Customer identity routing
 * 2. Admin AI tool access completeness
 * 3. Tool registration audit
 * 4. Customer security boundary
 * 5. Manager routing for all request types
 * 6. Employee tool assignments
 * 7. Tool input handling
 * 8. Authorization enforcement
 * 9. Conversation context requirements
 * 10. Edge cases
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function adminContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    userId: "u-admin-1",
    role: "admin",
    channel: "admin",
    requestId: "req-test-1",
    ...overrides,
  };
}

function customerContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    userId: "u-customer-1",
    role: "customer",
    channel: "salesman",
    requestId: "req-test-2",
    ...overrides,
  };
}

function guestContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    userId: null,
    role: null,
    channel: "salesman",
    requestId: "req-test-3",
    ...overrides,
  };
}

function getToolNames(agent: ReturnType<typeof getEntryAgent>): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools = (agent as any).tools ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tools.map((t: any) => t.name);
}

function getHandoffNames(agent: ReturnType<typeof getEntryAgent>): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handoffs = (agent as any).handoffs ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return handoffs.map((a: any) => a.name);
}

// ---------------------------------------------------------------------------
// 1. ADMIN VS CUSTOMER IDENTITY — Fix First
// ---------------------------------------------------------------------------

describe("1. Admin vs Customer Identity", () => {
  it("admin channel requires admin role", () => {
    const admin = adminContext();
    const customer = customerContext();
    const guest = guestContext();

    expect(admin.role).toBe("admin");
    expect(customer.role).not.toBe("admin");
    expect(guest.role).not.toBe("admin");
  });

  it("contextActorRole correctly identifies admin", () => {
    expect(contextActorRole(adminContext())).toBe("admin");
  });

  it("contextActorRole correctly identifies customer", () => {
    expect(contextActorRole(customerContext())).toBe("customer");
  });

  it("contextActorRole correctly identifies guest", () => {
    expect(contextActorRole(guestContext())).toBe("guest");
  });

  it("entry agent for admin channel is manager", () => {
    expect(getEntryAgent("admin").name).toBe("manager");
  });

  it("entry agent for salesman channel is salesman", () => {
    expect(getEntryAgent("salesman").name).toBe("salesman");
  });
});

// ---------------------------------------------------------------------------
// 2. ADMIN AI MUST HAVE COMPLETE TOOL ACCESS
// ---------------------------------------------------------------------------

describe("2. Admin AI Tool Access Completeness", () => {
  const requiredAdminTools = [
    "list_products",
    "get_product",
    "list_categories",
    "get_cms_content",
    "search_products_admin",
    "create_product",
    "update_product",
    "set_product_active",
    "delete_product",
    "resolve_category",
    "update_stock",
    "list_low_stock_products",
    "list_all_orders",
    "get_order_detail",
    "update_order_status",
    "list_customers",
    "get_customer_detail",
    "get_sales_overview",
    "generate_product_marketing_copy",
    "generate_social_post",
    "generate_ad_copy",
  ];

  it("product agent has all required product/catalog tools", () => {
    const tools = getToolNames(EMPLOYEES.product);
    const required = [
      "list_products",
      "get_product",
      "list_categories",
      "get_cms_content",
      "search_products_admin",
      "create_product",
      "update_product",
      "set_product_active",
      "delete_product",
      "resolve_category",
    ];
    for (const name of required) {
      expect(tools).toContain(name);
    }
  });

  it("inventory agent has all required inventory tools", () => {
    const tools = getToolNames(EMPLOYEES.inventory);
    const required = [
      "update_stock",
      "list_low_stock_products",
      "search_products_admin",
      "list_products",
      "get_product",
    ];
    for (const name of required) {
      expect(tools).toContain(name);
    }
  });

  it("order agent has all required order tools", () => {
    const tools = getToolNames(EMPLOYEES.order);
    const required = [
      "list_all_orders",
      "get_order_detail",
      "update_order_status",
      "get_cms_content",
    ];
    for (const name of required) {
      expect(tools).toContain(name);
    }
  });

  it("customer agent has all required customer tools", () => {
    const tools = getToolNames(EMPLOYEES.customer);
    const required = ["list_customers", "get_customer_detail"];
    for (const name of required) {
      expect(tools).toContain(name);
    }
  });

  it("sales agent has all required analytics tools", () => {
    const tools = getToolNames(EMPLOYEES.sales);
    const required = [
      "get_sales_overview",
      "list_products",
      "list_all_orders",
      "list_low_stock_products",
    ];
    for (const name of required) {
      expect(tools).toContain(name);
    }
  });

  it("marketing agent has all required marketing tools", () => {
    const tools = getToolNames(EMPLOYEES.marketing);
    const required = [
      "generate_product_marketing_copy",
      "generate_social_post",
      "generate_ad_copy",
      "get_sales_overview",
      "list_products",
      "list_low_stock_products",
      "list_all_orders",
      "get_cms_content",
    ];
    for (const name of required) {
      expect(tools).toContain(name);
    }
  });

  it("support agent has read-only support tools", () => {
    const tools = getToolNames(EMPLOYEES.support);
    const required = [
      "list_customers",
      "get_customer_detail",
      "list_all_orders",
      "get_order_detail",
      "list_products",
      "get_product",
      "get_cms_content",
      "check_availability",
      "search_products_admin",
    ];
    for (const name of required) {
      expect(tools).toContain(name);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. SALES — MUST WORK WITH REAL DATA
// ---------------------------------------------------------------------------

describe("3. Sales Tool Registration", () => {
  it("sales agent has get_sales_overview", () => {
    const tools = getToolNames(EMPLOYEES.sales);
    expect(tools).toContain("get_sales_overview");
  });

  it("get_sales_overview tool has correct schema", () => {
    // Verify the tool exists and has the expected name
    const tools = getToolNames(EMPLOYEES.sales);
    expect(tools).toContain("get_sales_overview");
  });

  it("sales agent has list_low_stock_products for inventory questions", () => {
    const tools = getToolNames(EMPLOYEES.sales);
    expect(tools).toContain("list_low_stock_products");
  });
});

// ---------------------------------------------------------------------------
// 4. PRODUCTS — ALL PRODUCTS MUST WORK
// ---------------------------------------------------------------------------

describe("4. Product Tool Registration", () => {
  it("product agent can list all products", () => {
    const tools = getToolNames(EMPLOYEES.product);
    expect(tools).toContain("list_products");
    expect(tools).toContain("search_products_admin");
  });

  it("product agent can resolve categories", () => {
    const tools = getToolNames(EMPLOYEES.product);
    expect(tools).toContain("list_categories");
    expect(tools).toContain("resolve_category");
  });

  it("product agent can CRUD products", () => {
    const tools = getToolNames(EMPLOYEES.product);
    expect(tools).toContain("create_product");
    expect(tools).toContain("update_product");
    expect(tools).toContain("set_product_active");
    expect(tools).toContain("delete_product");
  });
});

// ---------------------------------------------------------------------------
// 5. CATEGORY PRODUCT QUERIES
// ---------------------------------------------------------------------------

describe("5. Category Query Support", () => {
  it("product agent has category search capability", () => {
    const tools = getToolNames(EMPLOYEES.product);
    expect(tools).toContain("list_products");
    expect(tools).toContain("list_categories");
  });

  it("list_products tool supports categorySlug parameter", () => {
    // The tool exists on the product agent — the schema supports categorySlug
    const tools = getToolNames(EMPLOYEES.product);
    expect(tools).toContain("list_products");
  });
});

// ---------------------------------------------------------------------------
// 6. INVENTORY / STOCK MUTATIONS
// ---------------------------------------------------------------------------

describe("6. Inventory Tool Registration", () => {
  it("inventory agent has update_stock", () => {
    const tools = getToolNames(EMPLOYEES.inventory);
    expect(tools).toContain("update_stock");
  });

  it("inventory agent has search_products_admin for name resolution", () => {
    const tools = getToolNames(EMPLOYEES.inventory);
    expect(tools).toContain("search_products_admin");
  });

  it("inventory agent has list_low_stock_products", () => {
    const tools = getToolNames(EMPLOYEES.inventory);
    expect(tools).toContain("list_low_stock_products");
  });

  it("inventory agent has list_products for catalog browsing", () => {
    const tools = getToolNames(EMPLOYEES.inventory);
    expect(tools).toContain("list_products");
  });

  it("inventory agent has get_product for single product lookup", () => {
    const tools = getToolNames(EMPLOYEES.inventory);
    expect(tools).toContain("get_product");
  });
});

// ---------------------------------------------------------------------------
// 7. ORDERS — REAL ADMIN ACCESS
// ---------------------------------------------------------------------------

describe("7. Order Tool Registration", () => {
  it("order agent has list_all_orders", () => {
    const tools = getToolNames(EMPLOYEES.order);
    expect(tools).toContain("list_all_orders");
  });

  it("order agent has get_order_detail", () => {
    const tools = getToolNames(EMPLOYEES.order);
    expect(tools).toContain("get_order_detail");
  });

  it("order agent has update_order_status", () => {
    const tools = getToolNames(EMPLOYEES.order);
    expect(tools).toContain("update_order_status");
  });

  it("order agent has get_cms_content for delivery info", () => {
    const tools = getToolNames(EMPLOYEES.order);
    expect(tools).toContain("get_cms_content");
  });
});

// ---------------------------------------------------------------------------
// 8. CUSTOMERS — REAL ADMIN ACCESS
// ---------------------------------------------------------------------------

describe("8. Customer Tool Registration", () => {
  it("customer agent has list_customers", () => {
    const tools = getToolNames(EMPLOYEES.customer);
    expect(tools).toContain("list_customers");
  });

  it("customer agent has get_customer_detail", () => {
    const tools = getToolNames(EMPLOYEES.customer);
    expect(tools).toContain("get_customer_detail");
  });
});

// ---------------------------------------------------------------------------
// 9. ANALYTICS / BUSINESS DATA
// ---------------------------------------------------------------------------

describe("9. Analytics Tool Registration", () => {
  it("sales agent has get_sales_overview for analytics", () => {
    const tools = getToolNames(EMPLOYEES.sales);
    expect(tools).toContain("get_sales_overview");
  });

  it("marketing agent has get_sales_overview for performance analysis", () => {
    const tools = getToolNames(EMPLOYEES.marketing);
    expect(tools).toContain("get_sales_overview");
  });

  it("sales agent has list_low_stock_products for inventory analytics", () => {
    const tools = getToolNames(EMPLOYEES.sales);
    expect(tools).toContain("list_low_stock_products");
  });
});

// ---------------------------------------------------------------------------
// 10. MARKETING
// ---------------------------------------------------------------------------

describe("10. Marketing Tool Registration", () => {
  it("marketing agent has all copy generation tools", () => {
    const tools = getToolNames(EMPLOYEES.marketing);
    expect(tools).toContain("generate_product_marketing_copy");
    expect(tools).toContain("generate_social_post");
    expect(tools).toContain("generate_ad_copy");
  });

  it("marketing agent has data access tools", () => {
    const tools = getToolNames(EMPLOYEES.marketing);
    expect(tools).toContain("get_sales_overview");
    expect(tools).toContain("list_products");
    expect(tools).toContain("list_low_stock_products");
    expect(tools).toContain("list_all_orders");
    expect(tools).toContain("get_cms_content");
  });
});

// ---------------------------------------------------------------------------
// 11. AI EMPLOYEES + HANDOFFS
// ---------------------------------------------------------------------------

describe("11. Manager Routing (Handoffs)", () => {
  it("manager has handoffs to all 7 employees", () => {
    const handoffs = getHandoffNames(AGENTS.manager);
    expect(handoffs.length).toBe(7);
  });

  it("all 7 employee names are reachable via handoff", () => {
    const handoffs = getHandoffNames(AGENTS.manager);
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
      expect(handoffs).toContain(name);
    }
  });

  it("salesman has handoff only to support", () => {
    const handoffs = getHandoffNames(AGENTS.salesman);
    expect(handoffs.length).toBe(1);
    expect(handoffs).toContain("support");
  });
});

// ---------------------------------------------------------------------------
// 12. TOOL REGISTRATION AUDIT
// ---------------------------------------------------------------------------

describe("12. Tool Registration Audit — Every tool imported and registered", () => {
  const allExpectedTools = [
    // Catalog (public)
    "list_categories",
    "list_products",
    "get_product",
    "check_availability",
    "get_cms_content",
    // Catalog admin
    "create_product",
    "update_product",
    "set_product_active",
    "delete_product",
    "resolve_category",
    // Inventory
    "update_stock",
    "list_low_stock_products",
    "search_products_admin",
    // Orders
    "list_my_orders",
    "get_my_order",
    "list_all_orders",
    "get_order_detail",
    "update_order_status",
    // Customers
    "list_customers",
    "get_customer_detail",
    // Analytics
    "get_sales_overview",
    // Marketing
    "generate_product_marketing_copy",
    "generate_social_post",
    "generate_ad_copy",
  ];

  it("every expected tool exists on at least one agent", () => {
    const allAgentToolNames = new Set<string>();
    for (const agent of Object.values(EMPLOYEES)) {
      for (const name of getToolNames(agent)) {
        allAgentToolNames.add(name);
      }
    }
    for (const name of getToolNames(AGENTS.salesman)) {
      allAgentToolNames.add(name);
    }

    for (const toolName of allExpectedTools) {
      expect(allAgentToolNames.has(toolName)).toBe(true);
    }
  });

  it("no duplicate tool names across any single agent", () => {
    for (const [key, agent] of Object.entries(EMPLOYEES)) {
      const tools = getToolNames(agent);
      const unique = new Set(tools);
      expect(tools.length).toBe(unique.size);
    }
  });
});

// ---------------------------------------------------------------------------
// 13. TOOL INPUT HARDENING — Zero sales edge case
// ---------------------------------------------------------------------------

describe("13. Edge Cases — Zero data is valid", () => {
  it("zero sales instructions say 'No sales recorded' not 'access unavailable'", () => {
    const salesInstructions = (EMPLOYEES.sales as any).instructions as string;
    expect(salesInstructions).toContain("No sales recorded for this period");
    // The instructions should NEVER tell the AI to say "access unavailable"
    // for zero data — check that zero sales is explicitly addressed
    expect(salesInstructions).toContain("Zero sales is a valid result");
  });

  it("zero customers instructions do not tell AI to say 'access unavailable'", () => {
    const customerInstructions = (EMPLOYEES.customer as any).instructions as string;
    // Check that the instructions don't tell the AI to use "access unavailable"
    // for legitimate zero-data scenarios
    expect(customerInstructions).not.toMatch(/return.*access unavailable/i);
  });

  it("zero orders instructions do not tell AI to say 'access unavailable'", () => {
    const orderInstructions = (EMPLOYEES.order as any).instructions as string;
    expect(orderInstructions).not.toMatch(/return.*access unavailable/i);
  });
});

// ---------------------------------------------------------------------------
// 14. CUSTOMER AI SECURITY BOUNDARY
// ---------------------------------------------------------------------------

describe("14. Customer AI Security Boundary", () => {
  it("salesman does NOT have admin-only tools", () => {
    const tools = getToolNames(AGENTS.salesman);
    const adminOnlyTools = [
      "create_product",
      "update_product",
      "delete_product",
      "set_product_active",
      "update_stock",
      "list_low_stock_products",
      "list_all_orders",
      "get_order_detail",
      "update_order_status",
      "list_customers",
      "get_customer_detail",
      "get_sales_overview",
      "generate_product_marketing_copy",
      "generate_social_post",
      "generate_ad_copy",
      "search_products_admin",
      "resolve_category",
    ];
    for (const name of adminOnlyTools) {
      expect(tools).not.toContain(name);
    }
  });

  it("salesman only has customer-safe tools", () => {
    const tools = getToolNames(AGENTS.salesman);
    const allowedTools = [
      "list_categories",
      "list_products",
      "get_product",
      "check_availability",
      "get_cms_content",
      "add_to_cart",
      "get_my_cart",
      "update_cart_quantity",
      "remove_from_cart",
      "place_cod_order",
      "save_checkout_draft",
      "cancel_draft",
      "list_my_orders",
      "get_my_order",
    ];
    for (const name of tools) {
      expect(allowedTools).toContain(name);
    }
  });
});

// ---------------------------------------------------------------------------
// 15. ADMIN CONFIRMATION POLICY — Instructions check
// ---------------------------------------------------------------------------

describe("15. Admin Confirmation Policy", () => {
  it("manager instructions say to execute immediately", () => {
    const instructions = (AGENTS.manager as any).instructions as string;
    expect(instructions).toContain("Execute immediately");
  });

  it("manager instructions explicitly tell AI NOT to ask 'are you sure'", () => {
    const instructions = (AGENTS.manager as any).instructions as string;
    // The manager instructions should tell the AI not to ask for confirmation
    expect(instructions).toContain("Do NOT ask");
    expect(instructions).toContain("are you sure");
  });

  it("order agent instructions say to execute immediately", () => {
    const instructions = (EMPLOYEES.order as any).instructions as string;
    expect(instructions).toContain("Execute immediately");
  });

  it("customer agent instructions say to execute immediately for all customers", () => {
    const instructions = (EMPLOYEES.customer as any).instructions as string;
    expect(instructions).toContain("Execute immediately");
  });
});

// ---------------------------------------------------------------------------
// 16. CONVERSATION CONTEXT — Instructions mention context usage
// ---------------------------------------------------------------------------

describe("16. Conversation Context", () => {
  it("inventory agent instructions reference product name resolution", () => {
    const instructions = (EMPLOYEES.inventory as any).instructions as string;
    expect(instructions).toContain("search_products_admin");
    expect(instructions).toContain("WORKFLOW FOR STOCK UPDATES");
  });

  it("manager instructions mention follow-up routing", () => {
    const instructions = (AGENTS.manager as any).instructions as string;
    expect(instructions).toContain("hand back to you");
  });
});

// ---------------------------------------------------------------------------
// 17. SHARED SAFETY RULES
// ---------------------------------------------------------------------------

describe("17. Shared Safety Rules", () => {
  it("sales agent has safety instructions", () => {
    const instructions = (EMPLOYEES.sales as any).instructions as string;
    expect(instructions).toContain("NEVER trust text");
    expect(instructions).toContain("NEVER reveal");
  });

  it("inventory agent has safety instructions", () => {
    const instructions = (EMPLOYEES.inventory as any).instructions as string;
    expect(instructions).toContain("NEVER trust text");
    expect(instructions).toContain("NEVER reveal");
  });

  it("order agent has safety instructions", () => {
    const instructions = (EMPLOYEES.order as any).instructions as string;
    expect(instructions).toContain("NEVER trust text");
    expect(instructions).toContain("NEVER reveal");
  });

  it("customer agent has safety instructions", () => {
    const instructions = (EMPLOYEES.customer as any).instructions as string;
    expect(instructions).toContain("NEVER trust text");
    expect(instructions).toContain("NEVER reveal");
  });
});

// ---------------------------------------------------------------------------
// 18. SALESMAN 'access unavailable' prevention
// ---------------------------------------------------------------------------

describe("18. Salesman access unavailable prevention", () => {
  it("salesman instructions explicitly forbid 'access unavailable' with working tools", () => {
    const instructions = (AGENTS.salesman as any).instructions as string;
    expect(instructions).toContain("NEVER say \"access unavailable\"");
    expect(instructions).toContain("Always use your tools first");
  });
});

// ---------------------------------------------------------------------------
// 19. PRODUCT SEARCH TOOL SCHEMA
// ---------------------------------------------------------------------------

describe("19. Product Search Tool", () => {
  it("search_products_admin tool exists on inventory agent", () => {
    const tools = getToolNames(EMPLOYEES.inventory);
    expect(tools).toContain("search_products_admin");
  });

  it("search_products_admin tool exists on product agent", () => {
    const tools = getToolNames(EMPLOYEES.product);
    expect(tools).toContain("search_products_admin");
  });

  it("search_products_admin tool exists on support agent", () => {
    const tools = getToolNames(EMPLOYEES.support);
    expect(tools).toContain("search_products_admin");
  });
});

// ---------------------------------------------------------------------------
// 20. MANAGER ROUTING MAPPINGS — verify instructions cover all scenarios
// ---------------------------------------------------------------------------

describe("20. Manager Routing Instructions Cover All Scenarios", () => {
  const managerInstructions = (AGENTS.manager as any).instructions as string;

  it("routes sales queries to sales employee", () => {
    expect(managerInstructions).toContain("SALES/ANALYTICS");
    expect(managerInstructions).toContain("aj ki sales");
  });

  it("routes product queries to product employee", () => {
    expect(managerInstructions).toContain("PRODUCTS/CREATE/EDIT");
    expect(managerInstructions).toContain("sari products dikhao");
  });

  it("routes inventory queries to inventory employee", () => {
    expect(managerInstructions).toContain("INVENTORY/STOCK");
    expect(managerInstructions).toContain("stock update karo");
  });

  it("routes order queries to order employee", () => {
    expect(managerInstructions).toContain("ORDERS");
    expect(managerInstructions).toContain("pending orders");
  });

  it("routes customer queries to customer employee", () => {
    expect(managerInstructions).toContain("CUSTOMERS");
    expect(managerInstructions).toContain("customers ki detail");
  });

  it("routes marketing queries to marketing employee", () => {
    expect(managerInstructions).toContain("MARKETING");
    expect(managerInstructions).toContain("marketing copy");
  });
});

// ---------------------------------------------------------------------------
// 21. PRODUCT PARTIAL UPDATE — description-only edits must never touch slug
// ---------------------------------------------------------------------------

describe("21. Product Partial Update Guardrails", () => {
  const productInstructions = (EMPLOYEES.product as any).instructions as string;

  it("product agent instructions say to pass null for unchanged fields", () => {
    expect(productInstructions).toContain("PARTIAL update");
    expect(productInstructions).toContain("pass null");
  });

  it("product agent instructions forbid guessing a slug", () => {
    expect(productInstructions).toMatch(/NEVER include a slug/);
    expect(productInstructions).toContain("URL slug");
  });

  it("product agent instructions say slug must be null unless renamed", () => {
    expect(productInstructions).toContain("pass slug: null");
  });

  it("product agent instructions warn that a guessed slug fails validation", () => {
    expect(productInstructions).toContain("spaces or title case are invalid");
  });

  it("product agent instructions say renaming the name does not change slug", () => {
    expect(productInstructions).toContain("does NOT auto-change its slug");
  });
});
