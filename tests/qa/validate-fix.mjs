// Validate fix: toolChoice='required' on FULL production sales agent via handoff
import './load-env.mjs';

import { Agent, Runner } from '@openai/agents';
import { salesAgent } from '../../agents/employees.ts';

const salesRequired = new Agent({
  name: salesAgent.name,
  handoffDescription: salesAgent.handoffDescription,
  instructions: salesAgent.instructions,
  tools: salesAgent.tools,
  inputGuardrails: salesAgent.inputGuardrails,
  modelSettings: { toolChoice: 'required' },
});

const miniManager = new Agent({
  name: 'manager',
  instructions: 'You are the AI manager. Route sales questions to the sales agent via handoff.',
  handoffs: [salesRequired],
});

const ctx = { role: 'admin', userId: '5a6f3d41-d8d9-4321-ba39-e18dbc1500f3', channel: 'admin', requestId: 'fix-' + Date.now() };

async function one(i) {
  const runner = new Runner({ model: 'gpt-5.6-luna' });
  const result = await runner.run(miniManager, 'aaj ki sales batao', { stream: true, maxTurns: 8, context: ctx });
  let calls = [];
  let text = '';
  for await (const event of result) {
    if (event.type === 'raw_model_stream_event') {
      if (event.data?.type === 'output_text_delta') text += event.data.delta;
      if (event.data?.type === 'function_call') calls.push('FC:' + event.data.name);
    } else if (event.type === 'run_item_stream_event') {
      if (event.name === 'tool_called') calls.push('TOOL:' + (event.item?.rawItem?.name || ''));
      else if (event.name === 'handoff_occurred') calls.push('HANDOFF:' + (event.item?.rawItem?.name || ''));
    } else if (event.type === 'agent_updated_stream_event') {
      calls.push('agent:' + event.agent?.name);
    }
  }
  const got = calls.some(c => c.includes('get_sales_overview'));
  console.log(`run${i}: ${got ? 'TOOL-CALL' : 'NO-TOOL'} [${calls.join(' | ')}] "${text.substring(0, 120)}"`);
  return got;
}

let ok = 0;
for (let i = 1; i <= 6; i++) {
  try { if (await one(i)) ok++; } catch (e) { console.log(`run${i}: ERROR ${e.message}`); }
}
console.log(`\nfix success: ${ok}/6`);