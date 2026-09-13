import { tool, type RunContext } from "@openai/agents";
import { z } from "zod";

import type { AgentContext } from "@/agents/context";
import { toolRoleGuardrail, ADMIN_ROLE } from "@/guardians/authorization";
import { todayKeyPKT } from "@/lib/time";
import { getSalesAnalytics } from "@/services/analytics/analytics-service";
import { withToolAudit } from "@/tools/shared/audit";
import { asResult } from "@/tools/shared/result";

const adminActor = (ctx: AgentContext) => ({
  id: ctx.userId!,
  role: "admin" as const,
});

export const getSalesOverview = tool({
  name: "get_sales_overview",
  description:
    "Get sales analytics (admin): revenue, orders, customers, top products and trend. Use for reports and business questions including 'today sales', 'weekly sales', 'monthly sales', 'total revenue'.",
  parameters: z.object({
    trendDays: z.number().int().min(7).max(90).default(14),
    topProductLimit: z.number().int().min(1).max(20).default(5),
  }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("get_sales_overview", [ADMIN_ROLE])],
  async execute(
    { trendDays, topProductLimit }: {
      trendDays: number;
      topProductLimit: number;
    },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;
    const actor = adminActor(ctx);
    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "get_sales_overview",
        actionType: "analytics.sales.read",
        risk: "low",
        summary: "Read sales overview",
      },
      async () =>
        asResult(() => getSalesAnalytics(actor, { trendDays, topProductLimit })),
    );
    if (!result.ok) return result;

    const data = result.data;

    // Compute today's specific metrics from the trend data using Pakistan time
    const todayKey = todayKeyPKT();
    const todayTrend = data.salesTrend.find((t) => t.dateKey === todayKey);
    const todayRevenue = todayTrend?.revenue ?? 0;
    const todayOrders = todayTrend?.orderCount ?? 0;

    return {
      ok: true,
      data: {
        revenue: `PKR ${data.revenue.toLocaleString("en-PK")}`,
        orderCount: data.ordersCount,
        activeOrderCount: data.activeOrderCount,
        customerCount: data.customersCount,
        averageOrderValue: `PKR ${data.averageOrderValue.toLocaleString("en-PK")}`,
        lowStockCount: data.lowStockProducts.length,
        todayRevenue: `PKR ${todayRevenue.toLocaleString("en-PK")}`,
        todayOrders,
        statusDistribution: data.statusDistribution,
        topProducts: data.topProducts.map((p) => ({
          name: p.productName,
          quantity: p.unitsSold,
          revenue: `PKR ${Math.round(p.revenue).toLocaleString("en-PK")}`,
        })),
        trend: data.salesTrend.map((t) => ({
          date: t.dateKey,
          label: t.label,
          revenue: `PKR ${Math.round(t.revenue).toLocaleString("en-PK")}`,
          orders: t.orderCount,
        })),
      },
    };
  },
});
