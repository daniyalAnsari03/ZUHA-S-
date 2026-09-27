import { tool, type RunContext } from "@openai/agents";
import { z } from "zod";

import type { AgentContext } from "@/agents/context";
import type { OrderStatus } from "@/lib/supabase/types";
import {
  toolRoleGuardrail,
  ADMIN_ROLE,
  CUSTOMER_ROLE,
} from "@/guardians/authorization";
import {
  advanceOrderStatus,
  getAdminOrderDetail,
  getAdminOrderIdByNumber,
  getOrderDetail,
  listAllOrders,
  listCustomerOrders,
  updateOrderStatus,
} from "@/services/orders/order-service";
import { ORDER_STATUSES, STATUS_LABELS } from "@/services/analytics/analytics-service";
import { withToolAudit } from "@/tools/shared/audit";
import { asResult, denied, invalid, normalizeString } from "@/tools/shared/result";

const adminActor = (ctx: AgentContext) => ({
  id: ctx.userId!,
  role: "admin" as const,
});

/**
 * Admin order references: accept either the order UUID (orderId) or the
 * human-facing order number (orderNumber, e.g. DINS-2026-xxxx). The AI pairs
 * these from list_all_orders results or from an order number mentioned by the
 * owner. Exactly one is required.
 */
function resolveAdminOrderId(
  ctx: AgentContext,
  ref: { orderId?: string; orderNumber?: string },
): Promise<string | null> {
  if (ref.orderId) return Promise.resolve(ref.orderId);
  if (ref.orderNumber) {
    return getAdminOrderIdByNumber(adminActor(ctx), ref.orderNumber);
  }
  return Promise.resolve(null);
}

function orderSummaryLine(order: { id: string; order_number: string; status: string; total: number; created_at: string }) {
  return {
    orderId: order.id,
    orderNumber: order.order_number,
    status: order.status,
    statusLabel: STATUS_LABELS[order.status as keyof typeof STATUS_LABELS] ?? order.status,
    total: `PKR ${order.total.toLocaleString("en-PK")}`,
    placedAt: order.created_at,
  };
}

/**
 * Order tools. Customer tools are scoped to the caller's own orders (RLS +
 * userId binding); admin tools require an admin session and operate across all
 * orders. Order status changes are validated by the service transition rules.
 */

export const listMyOrders = tool({
  name: "list_my_orders",
  description:
    "List the signed-in customer's own orders with order id, order number, status and total. Each order includes its orderId — use it with get_my_order for full detail or tracking.",
  parameters: z.object({}),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("list_my_orders", [CUSTOMER_ROLE])],
  async execute(_params: object, runContext?: RunContext<AgentContext>) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;
    if (!ctx.userId) {
      return denied("You need to be signed in to see your orders.");
    }
    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "list_my_orders",
        actionType: "orders.own.list",
        risk: "low",
        summary: "List own orders",
      },
      async () => asResult(() => listCustomerOrders(ctx.userId!)),
    );
    if (!result.ok) return result;
    return { ok: true, data: result.data.map(orderSummaryLine) };
  },
});

export const getMyOrder = tool({
  name: "get_my_order",
  description:
    "Get details for one of the signed-in customer's own orders by order id (the orderId from list_my_orders), including items and status history. Ownership is enforced.",
  parameters: z.object({ orderId: z.string().uuid() }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("get_my_order", [CUSTOMER_ROLE])],
  async execute(
    { orderId }: { orderId: string },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;
    if (!ctx.userId) {
      return denied("You need to be signed in to see your order.");
    }
    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "get_my_order",
        actionType: "orders.own.detail",
        risk: "low",
        entityType: "order",
        entityId: orderId,
        summary: "Read own order detail",
      },
      async () => asResult(() => getOrderDetail(ctx.userId!, orderId)),
    );
    if (!result.ok) return result;
    return {
      ok: true,
      data: {
        ...orderSummaryLine(result.data),
        trackingId: (result.data as { tracking_id?: string | null }).tracking_id ?? null,
        items: (result.data as { items?: unknown[] }).items ?? [],
      },
    };
  },
});

export const listAllOrdersTool = tool({
  name: "list_all_orders",
  description:
    "List all orders across the business (admin). Optional filters: status, search (order number, customer name/email), pagination. Each order includes its orderId — use that orderId with get_order_detail or update_order_status.",
  parameters: z.object({
    status: z.enum(ORDER_STATUSES as [string, ...string[]]).optional(),
    search: z.string().max(120).optional(),
    limit: z.number().int().min(1).max(50).optional(),
    offset: z.number().int().min(0).optional(),
  }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("list_all_orders", [ADMIN_ROLE])],
  async execute(
    { status, search, limit, offset }: {
      status?: string;
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
        toolName: "list_all_orders",
        actionType: "orders.list",
        risk: "low",
        summary: normalizedSearch ? `List orders matching "${normalizedSearch}"` : "List orders",
      },
      async () =>
        asResult(() =>
          listAllOrders(actor, {
            status: status as OrderStatus | undefined,
            search: normalizedSearch,
            limit,
            offset,
          }),
        ),
    );
    if (!result.ok) return result;
    return {
      ok: true,
      data: {
        total: result.data.total,
        orders: result.data.orders.map(orderSummaryLine),
      },
    };
  },
});

export const getOrderDetailTool = tool({
  name: "get_order_detail",
  description:
    "Get full detail for any order (admin) including all items and status history. Provide either orderId (the UUID from list_all_orders) or orderNumber (e.g. DINS-2026-xxxx). Useful before changing an order.",
  parameters: z.object({
    orderId: z.string().uuid().optional(),
    orderNumber: z.string().trim().max(40).optional(),
  }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("get_order_detail", [ADMIN_ROLE])],
  async execute(
    { orderId, orderNumber }: { orderId?: string; orderNumber?: string },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;
    const actor = adminActor(ctx);
    const resolved = await resolveAdminOrderId(ctx, { orderId, orderNumber });
    if (!resolved) return invalid("Provide exactly one of orderId or orderNumber.");
    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "get_order_detail",
        actionType: "orders.detail",
        risk: "low",
        entityType: "order",
        entityId: resolved,
        summary: orderNumber ? `Read order detail for ${orderNumber}` : "Read order detail",
      },
      async () => asResult(() => getAdminOrderDetail(actor, resolved)),
    );
    if (!result.ok) return result;
    return { ok: true, data: result.data };
  },
});

export const updateOrderStatusTool = tool({
  name: "update_order_status",
  description:
    "Change an order's fulfillment/payment status (admin). Provide either orderId (the UUID from list_all_orders) or orderNumber (e.g. DINS-2026-xxxx). Valid transitions are enforced by the service. e.g. pending → confirmed → processing → shipped → delivered.",
  parameters: z.object({
    orderId: z.string().uuid().optional(),
    orderNumber: z.string().trim().max(40).optional(),
    newStatus: z.enum(ORDER_STATUSES as [string, ...string[]]),
    note: z.string().max(500).optional(),
  }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("update_order_status", [ADMIN_ROLE])],
  async execute(
    { orderId, orderNumber, newStatus, note }: {
      orderId?: string;
      orderNumber?: string;
      newStatus: string;
      note?: string;
    },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;
    const actor = adminActor(ctx);
    const resolved = await resolveAdminOrderId(ctx, { orderId, orderNumber });
    if (!resolved) return invalid("Provide exactly one of orderId or orderNumber.");
    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "update_order_status",
        actionType: "order.status.update",
        risk: "medium",
        entityType: "order",
        entityId: resolved,
        summary: `Update order status to ${newStatus}${orderNumber ? ` (${orderNumber})` : ""}`,
      },
      async () =>
        asResult(() =>
          updateOrderStatus(
            actor,
            resolved,
            newStatus as OrderStatus,
            note,
          ),
        ),
    );
    if (!result.ok) return result;
    return {
      ok: true,
      data: { orderId: resolved, orderNumber, newStatus, note: note ?? null },
    };
  },
});

export const advanceOrderStatusTool = tool({
  name: "advance_order_status",
  description:
    "Advance an order through one or more VALID status steps in sequence (admin). Provide the orderId or orderNumber and the steps in order; every step must be a valid single transition from the previous one (pending → confirmed → processing → shipped → delivered). Useful for combined requests such as moving a pending order into processing (steps [\"confirmed\", \"processing\"]). Executes the whole chain, records each history step, and verifies the final status before returning.",
  parameters: z.object({
    orderId: z.string().uuid().optional(),
    orderNumber: z.string().trim().max(40).optional(),
    steps: z
      .array(z.enum(ORDER_STATUSES as [string, ...string[]]))
      .min(1)
      .max(4),
    note: z.string().max(500).optional(),
  }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("advance_order_status", [ADMIN_ROLE])],
  async execute(
    { orderId, orderNumber, steps, note }: {
      orderId?: string;
      orderNumber?: string;
      steps: string[];
      note?: string;
    },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;
    const actor = adminActor(ctx);
    const resolved = await resolveAdminOrderId(ctx, { orderId, orderNumber });
    if (!resolved) return invalid("Provide exactly one of orderId or orderNumber.");
    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "advance_order_status",
        actionType: "order.status.advance",
        risk: "medium",
        entityType: "order",
        entityId: resolved,
        summary: `Advance order status via ${steps.join(" → ")}${orderNumber ? ` (${orderNumber})` : ""}`,
      },
      async () =>
        asResult(() =>
          advanceOrderStatus(
            actor,
            resolved,
            steps as OrderStatus[],
            note,
          ),
        ),
    );
    if (!result.ok) return result;
    return {
      ok: true,
      data: {
        orderId: resolved,
        orderNumber,
        fromStatus: result.data.fromStatus,
        toStatus: result.data.toStatus,
        stepsApplied: result.data.stepsApplied,
        note: note ?? null,
      },
    };
  },
});
