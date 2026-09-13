// Replicate the EXACT app Runner config + inputItems to find the trigger of no-tool-call
import './load-env.mjs';

import { Runner, user } from '@openai/agents';
import { managerAgent } from '../../agents/manager.ts';
import { AI_MODEL, MAX_AGENT_TURNS } from '../../agents/config.ts';
import { buildInputItems } from '../../services/ai/chat-service.ts';

const requestId = globalThis.crypto.randomUUID();
const context = {
  userId: '5a6f3d41-d8d9-4321-ba39-e18dbc1500f3',
  role: 'admin',
  channel: 'admin',
  requestId,
  conversationId: undefined,
};

const inputItems = buildInputItems([], 'aaj ki sales batao');

async function runScenario(label, opts) {
  const runner = new Runner(opts);
  try {
    const result = await runner.run(managerAgent, inputItems, {
      stream: true,
      context,
      maxTurns: MAX_AGENT_TURNS,
    });
    let calls = [];
    let text = '';
    for await (const event of result) {
      if (event.type === 'raw_model_stream_event') {
        if (event.data?.type === 'output_text_delta') text += event.data.delta;
        if (event.data?.type === 'function_call') calls.push('FC:' + event.data.name);
      } else if (event.type === 'run_item_stream_event') {
        if (event.name === 'tool_called') calls.push(('TOOL:' + (event.item?.rawItem?.name || '')));
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

// A: app config exactly
await runScenario('APP-EXACT (workflowName/groupId/traceMetadata/traceIncludeSensitiveData + items)', {
  model: AI_MODEL,
  workflowName: 'ai_workplace',
  groupId: `ct-${requestId}`,
  traceMetadata: { channel: 'admin', requestId, actorRole: 'admin' },
  traceIncludeSensitiveData: false,
});

// B: plain Runner, same items
await runScenario('PLAIN-RUNNER + items', { model: AI_MODEL });

// C: plain Runner, raw string
{
  const runner = new Runner({ model: AI_MODEL });
  try {
    const result = await runner.run(managerAgent, 'aaj ki sales batao', {
      stream: true,
      context,
      maxTurns: MAX_AGENT_TURNS,
    });
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
    console.log('\n=== PLAIN-RUNNER + string ===');
    console.log('sequence:', calls.join(' | '));
    console.log('text:', text.substring(0, 250));
  } catch (e) {
    console.log('\n=== PLAIN-RUNNER + string ===');
    console.log('ERROR:', e.message);
  }
}