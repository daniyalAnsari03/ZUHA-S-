import { tool, type RunContext } from "@openai/agents";
import { z } from "zod";

import type { AgentContext } from "@/agents/context";
import { toolRoleGuardrail, ADMIN_ROLE } from "@/guardians/authorization";
import {
  getCustomerDetail,
  listCustomers,
} from "@/services/customers/customers-service";
import { withToolAudit } from "@/tools/shared/audit";
import { asResult, notFound, normalizeString } from "@/tools/shared/result";

const adminActor = (ctx: AgentContext) => ({
  id: ctx.userId!,
  role: "admin" as const,
});

export const listCustomersTool = tool({
  name: "list_customers",
  description:
    "List customers with order summary (admin). Optional search on name, phone or city, with pagination.",
  parameters: z.object({
    search: z.string().max(120).optional(),
    limit: z.number().int().min(1).max(50).optional(),
    offset: z.number().int().min(0).optional(),
  }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("list_customers", [ADMIN_ROLE])],
  async execute(
    { search, limit, offset }: {
      search?: string;
      limit?: number;
      offset?: number;
    },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;
    const actor = adminActor(ctx);
    const normalizedSearch = normalizeString(search);
    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "list_customers",
        actionType: "customers.list",
        risk: "low",
        summary: normalizedSearch ? `Search customers "${normalizedSearch}"` : "List customers",
      },
      async () => asResult(() => listCustomers(actor, { search: normalizedSearch, limit, offset })),
    );
    if (!result.ok) return result;
    return { ok: true, data: result.data };
  },
});

export const getCustomerDetailTool = tool({
  name: "get_customer_detail",
  description:
    "Get full customer detail including profile and complete order history (admin).",
  parameters: z.object({ customerId: z.string().uuid() }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("get_customer_detail", [ADMIN_ROLE])],
  async execute(
    { customerId }: { customerId: string },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;
    const actor = adminActor(ctx);
    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "get_customer_detail",
        actionType: "customers.detail",
        risk: "low",
        entityType: "customer",
        entityId: customerId,
        summary: "Read customer detail",
      },
      async () => asResult(() => getCustomerDetail(actor, customerId)),
    );
    if (!result.ok) return result;
    if (!result.data) {
      return notFound("Customer not found.");
    }
    return { ok: true, data: result.data };
  },
});
