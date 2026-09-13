// Re-run the FULL production manager->sales chain 5x to measure failure rate (as in the app)
import './load-env.mjs';

import { Runner } from '@openai/agents';
import { managerAgent } from '../../agents/manager.ts';

const ctx = { role: 'admin', userId: '5a6f3d41-d8d9-4321-ba39-e18dbc1500f3', channel: 'admin', requestId: 'it-' + Date.now() };

async function one(agent, label) {
  const runner = new Runner({ model: 'gpt-5.6-luna' });
  const result = await runner.run(agent, 'aaj ki sales batao', { stream: true, maxTurns: 8, context: ctx });
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
  const hasTool = calls.some(c => c.startsWith('TOOL:') || c.startsWith('FC:'));
  console.log(`${label}: ${hasTool ? 'TOOL-CALL' : 'NO-TOOL'} [${calls.join(' | ')}] "${text.substring(0, 100)}"`);
  return hasTool;
}

let ok = 0;
for (let i = 1; i <= 6; i++) {
  try { if (await one(managerAgent, `full-chain run${i}`)) ok++; } catch (e) { console.log(`run${i}: ERROR ${e.message}`); }
}
console.log(`\nfull chain tool-call success: ${ok}/6`);