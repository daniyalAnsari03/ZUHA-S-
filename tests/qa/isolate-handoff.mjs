// Isolate: direct-start vs handoff vs instructions
import './load-env.mjs';

import { Agent, Runner } from '@openai/agents';
import { z } from 'zod';
import { tool } from '@openai/agents';
import { salesAgent } from '../../agents/employees.ts';
import { managerAgent } from '../../agents/manager.ts';

const simpleTool = tool({
  name: 'get_sales_overview',
  description: 'Get sales analytics (admin): revenue, orders, customers, top products and trend.',
  parameters: z.object({ trendDays: z.number().int().min(7).max(90) }),
  strict: true,
  async execute({ trendDays }) {
    return { ok: true, data: { revenue: 'PKR 1,000', orderCount: 5, date: 'synthetic' } };
  },
});

const minimalSales = new Agent({
  name: 'sales',
  handoffDescription: 'Handles sales analytics. Use for today sales, revenue, trends.',
  instructions: 'You are the sales employee. When asked "aaj ki sales" or "today sales", call get_sales_overview immediately and report numbers. Never narrate without calling the tool.',
  tools: [simpleTool],
});

const minimalManager = new Agent({
  name: 'manager',
  instructions: 'You are the AI manager. Route sales questions to the sales agent via handoff.',
  handoffs: [minimalSales],
});

async function runScenario(label, agent, prompt, context) {
  const runner = new Runner({ model: 'gpt-5.6-luna' });
  try {
    const result = await runner.run(agent, prompt, {
      stream: true,
      maxTurns: 8,
      context,
    });
    let calls = [];
    let text = '';
    for await (const event of result) {
      if (event.type === 'raw_model_stream_event') {
        if (event.data?.type === 'output_text_delta') text += event.data.delta;
        if (event.data?.type === 'function_call') calls.push(event.data.name);
      } else if (event.type === 'run_item_stream_event') {
        if (event.name === 'tool_called') calls.push('TOOL:' + (event.item?.rawItem?.name || ''));
        else if (event.name === 'handoff_occurred') calls.push('HANDOFF:' + (event.item?.rawItem?.name || ''));
      } else if (event.type === 'agent_updated_stream_event') {
        calls.push('agent:' + event.agent?.name);
      }
    }
    console.log(`\n=== ${label} ===`);
    console.log('sequence:', calls.join(' | '));
    console.log('text:', text.substring(0, 250));
  } catch (e) {
    console.log(`\n=== ${label} ===`);
    console.log('ERROR:', e.message);
  }
}

const ctx = { role: 'admin', userId: '5a6f3d41-d8d9-4321-ba39-e18dbc1500f3', channel: 'admin', requestId: 'iso2' };

await runScenario('A: full production salesAgent DIRECT', salesAgent, 'aaj ki sales batao', ctx);
await runScenario('B: minimal manager -> minimal sales (handoff)', minimalManager, 'aaj ki sales batao', ctx);
await runScenario('C: full production manager -> full production sales', managerAgent, 'aaj ki sales batao', ctx);