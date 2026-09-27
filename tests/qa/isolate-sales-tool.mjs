// Isolate why production sales agent doesn't call get_sales_overview
import "./load-env.mjs";

import { Agent, Runner } from "@openai/agents";
import { z } from "zod";
import { tool } from "@openai/agents";
import { getSalesOverview } from "../../tools/analytics.ts";
import { listProducts } from "../../tools/catalog.ts";

const simpleTool = tool({
  name: "get_sales_overview",
  description:
    "Get sales analytics (admin): revenue, orders, customers, top products and trend.",
  parameters: z.object({
    trendDays: z.number().int().min(7).max(90),
  }),
  strict: true,
  async execute({ trendDays }) {
    return {
      ok: true,
      data: { revenue: "PKR 1,000", orderCount: 5, trendDays },
    };
  },
});

async function runScenario(label, agent) {
  const runner = new Runner({ model: "gpt-5.6-luna" });
  try {
    const result = await runner.run(agent, "aaj ki sales batao", {
      stream: true,
      maxTurns: 4,
      context: {
        role: "admin",
        userId: "5a6f3d41-d8d9-4321-ba39-e18dbc1500f3",
        channel: "admin",
        requestId: `iso-${label}`,
      },
    });
    const calls = [];
    let text = "";
    for await (const event of result) {
      if (event.type === "raw_model_stream_event") {
        if (event.data?.type === "output_text_delta") text += event.data.delta;
        if (event.data?.type === "function_call") {
          calls.push(
            JSON.stringify({
              name: event.data.name,
              args: event.data.arguments,
            }),
          );
        }
      } else if (event.type === "run_item_stream_event") {
        if (event.name === "tool_called") {
          calls.push("TOOL:" + (event.item?.rawItem?.name || ""));
        } else {
          // console.log('item event:', event.name);
        }
      }
    }
    console.log(`\n=== ${label} ===`);
    console.log("function calls:", calls.length ? calls.join(" | ") : "NONE");
    console.log("text:", text.substring(0, 300));
  } catch (e) {
    console.log(`\n=== ${label} ===`);
    console.log("ERROR:", e.message);
  }
}

const realAgent = new Agent({
  name: "sales",
  instructions:
    'You are the sales employee. When asked "aaj ki sales" or "today sales", call get_sales_overview immediately and report numbers. Never say "checking" without calling the tool.',
  tools: [getSalesOverview],
});

const simpleAgent = new Agent({
  name: "sales",
  instructions:
    'You are the sales employee. When asked "aaj ki sales" or "today sales", call get_sales_overview immediately and report numbers. Never say "checking" without calling the tool.',
  tools: [simpleTool],
});

await runScenario("real-production-tool", realAgent);
await runScenario("stripped-schema-tool", simpleAgent);
