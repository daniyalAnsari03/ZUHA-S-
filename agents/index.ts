import { Agent, handoff, type TextOutput } from "@openai/agents";

import type { AgentContext } from "./context";
import { managerAgent } from "./manager";
import { salesmanAgent } from "./salesman";
import {
  customerAgent,
  inventoryAgent,
  marketingAgent,
  orderAgent,
  productAgent,
  salesAgent,
  supportAgent,
} from "./employees";

export type AiAgent =
  Agent<AgentContext, TextOutput> & { name: string };

export const AGENTS = {
  manager: managerAgent,
  salesman: salesmanAgent,
} as const;

/** Registry of every employee agent, keyed by its logical role. */
export const EMPLOYEES = {
  product: productAgent,
  inventory: inventoryAgent,
  order: orderAgent,
  customer: customerAgent,
  sales: salesAgent,
  marketing: marketingAgent,
  support: supportAgent,
} as const;

/**
 * Employees must be able to hand OUT-OF-SCOPE requests back to the Manager so
 * it can re-route them, instead of refusing or improvising in plain text. The
 * back-handoff is wired here (not in employees.ts) to avoid a
 * manager ⇄ employees circular import, and is enabled ONLY for authenticated
 * admin threads — so the shared support employee can never carry a customer
 * conversation into the admin Manager.
 */
export const MANAGER_BACK_HANDOFF = handoff(managerAgent, {
  isEnabled: ({ runContext }) =>
    runContext.context.role === "admin" &&
    runContext.context.channel === "admin",
});

function hasManagerHandoff(agent: Agent<AgentContext>): boolean {
  return agent.handoffs.some((entry) => {
    const name = entry instanceof Agent ? entry.name : entry.agentName;
    return name === "manager";
  });
}

for (const agent of Object.values(EMPLOYEES)) {
  if (!hasManagerHandoff(agent)) {
    agent.handoffs.push(MANAGER_BACK_HANDOFF);
  }
}

/**
 * Entry agent for each channel:
 * - "admin"    → the AI Manager (business owner, full workforce).
 * - "salesman" → the AI Salesman (storefront customers, guests included).
 */
export function getEntryAgent(
  channel: "admin" | "salesman",
): Agent<AgentContext> {
  return channel === "admin" ? managerAgent : salesmanAgent;
}