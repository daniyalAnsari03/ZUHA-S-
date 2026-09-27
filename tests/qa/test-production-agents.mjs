// Test the actual production agents
import "./load-env.mjs";

import { Runner } from "@openai/agents";
import { managerAgent } from "../../agents/manager.ts";

async function run() {
  console.log("Manager name:", managerAgent.name);
  console.log("Manager handoffs:", managerAgent.handoffs?.length);

  const runner = new Runner({ model: "gpt-5.6-luna" });
  const result = await runner.run(managerAgent, "aaj ki sales batao", {
    stream: true,
    maxTurns: 8,
    context: {
      role: "admin",
      userId: "5a6f3d41-d8d9-4321-ba39-e18dbc1500f3",
      channel: "admin",
      requestId: "test-123",
    },
  });

  let text = "";
  const events = [];
  for await (const event of result) {
    if (event.type === "raw_model_stream_event") {
      const data = event.data;
      if (data?.type === "output_text_delta") text += data.delta;
    } else if (event.type === "run_item_stream_event") {
      const name = event.item?.rawItem?.name || event.name;
      events.push(event.name + ":" + name);
      if (event.name === "tool_called") {
        console.log("TOOL CALLED:", event.item?.rawItem?.name);
      }
    } else if (event.type === "agent_updated_stream_event") {
      events.push("agent:" + event.agent?.name);
    }
  }
  console.log("Events:", events.join(" | "));
  console.log("Text:", text.substring(0, 500));
}

run().catch((e) => {
  console.error("Error:", e.message);
  console.error(e.stack);
});
