// Gradient test: full sales instructions vs full tool list
import "./load-env.mjs";

import { Agent, Runner } from "@openai/agents";
import { salesAgent } from "../../agents/employees.ts";
import { listProducts } from "../../tools/catalog.ts";
import { listAllOrdersTool } from "../../tools/orders.ts";
import { listLowStockProducts } from "../../tools/inventory.ts";
import { getSalesOverview } from "../../tools/analytics.ts";

const MINIMAL_INSTRUCTIONS =
  'You are the sales employee. When asked "aaj ki sales" or "today sales", call get_sales_overview immediately and report the returned numbers. Never narrate without calling the tool.';

const ctx = {
  role: "admin",
  userId: "5a6f3d41-d8d9-4321-ba39-e18dbc1500f3",
  channel: "admin",
  requestId: "grad-" + Date.now(),
};

async function one(agent, label) {
  const runner = new Runner({ model: "gpt-5.6-luna" });
  let result;
  try {
    result = await runner.run(agent, "aaj ki sales batao", {
      stream: true,
      maxTurns: 6,
      context: ctx,
    });
  } catch (e) {
    console.log(`${label}: ERROR ${e.message}`);
    return false;
  }
  let calls = [];
  let text = "";
  for await (const event of result) {
    if (event.type === "raw_model_stream_event") {
      if (event.data?.type === "output_text_delta") text += event.data.delta;
      if (event.data?.type === "function_call")
        calls.push("FC:" + event.data.name);
    } else if (event.type === "run_item_stream_event") {
      if (event.name === "tool_called")
        calls.push("TOOL:" + (event.item?.rawItem?.name || ""));
    }
  }
  const ok2 = calls.some((c) => c.includes("get_sales_overview"));
  console.log(
    `${label}: ${ok2 ? "CALLED" : "NO-TOOL"} [${calls.join(" | ") || "none"}] "${text.substring(0, 100)}"`,
  );
  return ok2;
}

const cases = [
  [
    "1-full-instructions+min-tools",
    new Agent({
      name: "sales",
      instructions: salesAgent.instructions,
      tools: [{ name: "get_sales_overview" }].filter(
        () => false /* placeholder */,
      ),
    }),
  ],
  [
    "2-min-instructions+full-real-tools",
    new Agent({
      name: "sales",
      instructions: MINIMAL_INSTRUCTIONS,
      tools: [
        getSalesOverview,
        listProducts,
        listAllOrdersTool,
        listLowStockProducts,
      ],
    }),
  ],
  ["3-full-instructions+full-real-tools", salesAgent],
];

for (const [label, agent] of cases) {
  await one(agent, label);
}

// Drill: full instructions but ONLY the sales tool (real, with guardrail/defaults)
await one(
  new Agent({
    name: "sales",
    instructions: salesAgent.instructions,
    tools: [getSalesOverview],
  }),
  "4-full-instructions+only-sales-tool",
);
await one(
  new Agent({
    name: "sales",
    instructions: MINIMAL_INSTRUCTIONS,
    tools: [getSalesOverview],
  }),
  "5-min-instructions+only-sales-tool",
);
// Full instructions with a *simple* (no-default) sales tool is case-1 fix -> redo properly
import { z } from "zod";
import { tool } from "@openai/agents";
const simpleSalesTool = tool({
  name: "get_sales_overview",
  description:
    "Get sales analytics (admin): revenue, orders, customers, top products and trend.",
  parameters: z.object({ trendDays: z.number().int().min(7).max(90) }),
  strict: true,
  async execute() {
    return { ok: true, data: { revenue: "PKR 1,000", orderCount: 5 } };
  },
});
await one(
  new Agent({
    name: "sales",
    instructions: salesAgent.instructions,
    tools: [simpleSalesTool],
  }),
  "6-full-instructions+only-simple-sales-tool",
);
