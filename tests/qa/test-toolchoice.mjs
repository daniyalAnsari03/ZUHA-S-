// Test toolChoice:'required' fix for handoff -> no tool call
import "./load-env.mjs";

import { Agent, Runner } from "@openai/agents";
import { z } from "zod";
import { tool } from "@openai/agents";
import { managerAgent } from "../../agents/manager.ts";

const salesTool = tool({
  name: "get_sales_overview",
  description:
    "Get sales analytics (admin): revenue, orders, customers, top products and trend.",
  parameters: z.object({ trendDays: z.number().int().min(7).max(90) }),
  strict: true,
  async execute({ trendDays }) {
    return {
      ok: true,
      data: { revenue: "PKR 1,000", orderCount: 5, date: "synthetic" },
    };
  },
});

const salesRequired = new Agent({
  name: "sales",
  handoffDescription:
    "Handles sales analytics. Use for today sales, revenue, trends.",
  instructions:
    'You are the sales employee. When asked "aaj ki sales" or "today sales", call get_sales_overview immediately and report the returned numbers.',
  tools: [salesTool],
  modelSettings: { toolChoice: "required" },
});

const salesAuto = new Agent({
  name: "sales",
  handoffDescription:
    "Handles sales analytics. Use for today sales, revenue, trends.",
  instructions:
    'You are the sales employee. When asked "aaj ki sales" or "today sales", call get_sales_overview immediately and report the returned numbers.',
  tools: [salesTool],
});

// Manager hands off to a specific sales agent
function makeManager(target) {
  return new Agent({
    name: "manager",
    instructions:
      "You are the AI manager. Route sales questions to the sales agent via handoff.",
    handoffs: [target],
  });
}

async function runChain(manager, label) {
  const runner = new Runner({ model: "gpt-5.6-luna" });
  const result = await runner.run(manager, "aaj ki sales batao", {
    stream: true,
    maxTurns: 8,
    context: {
      role: "admin",
      userId: "5a6f3d41-d8d9-4321-ba39-e18dbc1500f3",
      channel: "admin",
      requestId: "fc-" + Date.now(),
    },
  });
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
      else if (event.name === "handoff_occurred")
        calls.push("HANDOFF:" + (event.item?.rawItem?.name || ""));
    } else if (event.type === "agent_updated_stream_event") {
      calls.push("agent:" + event.agent?.name);
    }
  }
  console.log(`${label}: ${calls.join(" | ")}`);
  console.log(`   text: "${text.substring(0, 150)}"`);
}

console.log("=== Chain with sales toolChoice=required, 4 runs ===");
for (let i = 1; i <= 4; i++) {
  try {
    await runChain(makeManager(salesRequired), `run${i}`);
  } catch (e) {
    console.log(`run${i}: ERROR ${e.message}`);
  }
}

console.log("\n=== Chain with sales toolChoice=auto, 4 runs ===");
for (let i = 1; i <= 4; i++) {
  try {
    await runChain(makeManager(salesAuto), `run${i}`);
  } catch (e) {
    console.log(`run${i}: ERROR ${e.message}`);
  }
}
