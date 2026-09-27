// Measure nondeterminism + test fixes for sales agent not calling tools after handoff
import "./load-env.mjs";

import { Agent, Runner } from "@openai/agents";
import { z } from "zod";
import { tool } from "@openai/agents";
import { salesAgent, orderAgent } from "../../agents/employees.ts";
import { managerAgent } from "../../agents/manager.ts";

const ctx = {
  role: "admin",
  userId: "5a6f3d41-d8d9-4321-ba39-e18dbc1500f3",
  channel: "admin",
  requestId: "loop-" + Date.now(),
};

// Tiny deterministic emulation: intercept real tool exec? No — use direct salesAgent but its tool hits real DB (works via admin client? no, cookies()).
// Instead measure whether a TOOL CALL is ATTEMPTED (function_call), not whether execution succeeds.

async function runOnce(agent, prompt) {
  const runner = new Runner({ model: "gpt-5.6-luna" });
  const result = await runner.run(agent, prompt, {
    stream: true,
    maxTurns: 6,
    context: ctx,
  });
  let called = false;
  let text = "";
  for await (const event of result) {
    if (event.type === "raw_model_stream_event") {
      if (event.data?.type === "output_text_delta") text += event.data.delta;
      if (event.data?.type === "function_call") called = true;
    } else if (
      event.type === "run_item_stream_event" &&
      event.name === "tool_called"
    ) {
      called = true;
    }
  }
  return { called, text: text.substring(0, 120) };
}

console.log("=== DIRECT salesAgent (no handoff), 5 runs ===");
let ok = 0;
for (let i = 1; i <= 5; i++) {
  const r = await runOnce(salesAgent, "aaj ki sales batao");
  if (r.called) ok++;
  console.log(`run ${i}: tool=${r.called} text="${r.text}"`);
}
console.log(`direct success rate: ${ok}/5`);

// Fix candidate: reasoning effort low
console.log("\n=== DIRECT salesAgent with reasoning effort low, 5 runs ===");
const zeroAgent = new Agent({
  name: "sales",
  instructions: salesAgent.instructions,
  tools: salesAgent.tools,
  inputGuardrails: salesAgent.inputGuardrails,
});
(async () => {
  // Can't easily pass reasoning via Runner model string. Try a plain OpenAI call directly (no SDK) to test reasoning levels.
})();

// Plain OpenAI Responses API with reasoning + tools, replicate supplier behavior
const OpenAI = await import("openai");
const client = new OpenAI.default({ apiKey: process.env.OPENAI_API_KEY });

async function directResponses(reasoningEffort) {
  const tools = [
    {
      type: "function",
      name: "get_sales_overview",
      description:
        'Get sales analytics (admin): revenue, orders, customers, top products and trend. Use for reports like "today sales", "weekly sales", "total revenue".',
      parameters: {
        type: "object",
        properties: {
          trendDays: { type: "number", minimum: 7, maximum: 90 },
          topProductLimit: { type: "number", minimum: 1, maximum: 20 },
        },
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: "function",
      name: "list_products",
      description: "List products in the catalog.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      strict: true,
    },
  ];
  const body = {
    model: "gpt-5.6-luna",
    input: [
      {
        role: "developer",
        content:
          typeof salesAgent.instructions === "string"
            ? salesAgent.instructions
            : "You are sales.",
      },
      {
        role: "user",
        content: "Aaj ki sales batao. Tool call karo aur numbers batao.",
      },
    ],
    tools,
    reasoning: reasoningEffort ? { effort: reasoningEffort } : undefined,
    stream: true,
  };
  const stream = await client.responses.create(body);
  let called = false;
  let text = "";
  for await (const event of stream) {
    if (event.type === "response.output_text.delta") text += event.delta;
    if (
      event.type === "response.function_call_arguments.delta" ||
      event.type === "response.function_call_arguments.done"
    )
      called = true;
  }
  return { called, text: text.substring(0, 120) };
}

for (const effort of ["none", "low", "medium"]) {
  let ok2 = 0;
  const labels = [];
  for (let i = 1; i <= 3; i++) {
    const r = await directResponses(effort);
    if (r.called) ok2++;
    labels.push(r.called ? "T" : "N");
  }
  console.log(
    `\nresponses reasoning=${effort}: ${ok2}/3 tool-calls [${labels.join(",")}]`,
  );
}
