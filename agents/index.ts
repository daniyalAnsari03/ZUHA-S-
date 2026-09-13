import type { Agent, TextOutput } from "@openai/agents";

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
 * Entry agent for each channel:
 * - "admin"    → the AI Manager (business owner, full workforce).
 * - "salesman" → the AI Salesman (storefront customers, guests included).
 */
export function getEntryAgent(
  channel: "admin" | "salesman",
): Agent<AgentContext> {
  return channel === "admin" ? managerAgent : salesmanAgent;
}