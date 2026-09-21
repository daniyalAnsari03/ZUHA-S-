import { tool, type RunContext } from "@openai/agents";
import { z } from "zod";

import type { AgentContext } from "@/agents/context";
import { toolRoleGuardrail, ADMIN_ROLE } from "@/guardians/authorization";
import {
  buildDailySalesSummary,
  buildWeeklySalesSummary,
} from "@/services/email/report-data-service";
import { sendReportEmail } from "@/services/email/email.service";
import { todayKeyPKT } from "@/lib/time";
import { withToolAudit } from "@/tools/shared/audit";
import { asResult } from "@/tools/shared/result";

type ReportTopProductRow = {
  name: string;
  quantity: string;
  revenue: string;
};

type ReportLowStockRow = {
  name: string;
  stock: number;
  threshold: number;
};

/** Format report data as plain, chat-safe "label: value" lines. */
function formatTopProducts(
  rows: { name: string; unitsSold: number; revenue: number }[],
): ReportTopProductRow[] {
  return rows.map((p) => ({
    name: p.name,
    quantity: String(p.unitsSold),
    revenue: `PKR ${Math.round(p.revenue).toLocaleString("en-PK")}`,
  }));
}

function formatLowStock(
  rows: { name: string; stockQuantity: number; lowStockThreshold: number }[],
): ReportLowStockRow[] {
  return rows.map((p) => ({
    name: p.name,
    stock: p.stockQuantity,
    threshold: p.lowStockThreshold,
  }));
}

/**
 * Admin-only read of today's (PKT) business summary — real, live data used by
 * the Sales Employee for "aaj ki report" / "today's sales" style questions.
 * Read-only, low risk.
 */
export const getDailySalesSummaryTool = tool({
  name: "get_daily_sales_summary",
  description:
    "Get today's (Pakistan time) business summary for the admin: revenue, order count, average order value, today's top products and low-stock items. Use for 'aaj ki report', 'today's summary', 'aaj kya bik raha hai'. Read-only.",
  parameters: z.object({}),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("get_daily_sales_summary", [ADMIN_ROLE])],
  async execute(_params: Record<string, never>, runContext?: RunContext<AgentContext>) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;

    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "get_daily_sales_summary",
        actionType: "reports.daily.read",
        risk: "low",
        summary: "Read today's sales summary",
      },
      async () => asResult(() => buildDailySalesSummary()),
    );
    if (!result.ok) return result;

    const data = result.data;
    return {
      ok: true,
      data: {
        date: data.dateKey,
        dateLabel: data.dateLabel,
        todayKey: todayKeyPKT(),
        revenue: `PKR ${Math.round(data.revenue).toLocaleString("en-PK")}`,
        orderCount: data.orderCount,
        averageOrderValue: `PKR ${Math.round(data.averageOrderValue).toLocaleString("en-PK")}`,
        topProducts: formatTopProducts(data.topProducts),
        lowStock: formatLowStock(data.lowStock),
      },
    };
  },
});

/**
 * Admin-only read of the trailing 7-day business summary with week-over-week
 * growth. Used by the Sales Employee for weekly reports.
 * Read-only, low risk.
 */
export const getWeeklySalesSummaryTool = tool({
  name: "get_weekly_sales_summary",
  description:
    "Get the trailing 7-day business summary (Pakistan time) for the admin: revenue, orders, growth vs the previous week, best sellers and low-stock items. Use for 'weekly report', 'is week ki sales'. Read-only.",
  parameters: z.object({}),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("get_weekly_sales_summary", [ADMIN_ROLE])],
  async execute(_params: Record<string, never>, runContext?: RunContext<AgentContext>) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;

    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "get_weekly_sales_summary",
        actionType: "reports.weekly.read",
        risk: "low",
        summary: "Read weekly sales summary",
      },
      async () => asResult(() => buildWeeklySalesSummary()),
    );
    if (!result.ok) return result;

    const data = result.data;
    return {
      ok: true,
      data: {
        week: data.weekLabel,
        revenue: `PKR ${Math.round(data.revenue).toLocaleString("en-PK")}`,
        previousRevenue: `PKR ${Math.round(data.previousRevenue).toLocaleString("en-PK")}`,
        revenueGrowthPercent:
          data.revenueGrowthPercent === null ? null : `${data.revenueGrowthPercent.toFixed(0)}%`,
        orderCount: data.orderCount,
        previousOrderCount: data.previousOrderCount,
        bestSellers: formatTopProducts(data.bestSellers),
        lowStock: formatLowStock(data.lowStock),
      },
    };
  },
});

/**
 * Admin-only tool that actually SENDS a business report email through the
 * Resend engine. The email body is built from REAL database data (daily or
 * weekly summary) plus a short AI insight. The send is risk-classified by the
 * Email Guardian, audited in email_logs, and verified (status re-read) before
 * being reported as sent. Use only when the owner explicitly asks to send a
 * report by email ("report email bhejo", "daily report email karo").
 */
export const sendReportEmailTool = tool({
  name: "send_report_email",
  description:
    "Send a business report email to the configured report address (Admin → Email Reports). Type must be 'daily' or 'weekly'. Builds the report from real database data plus an AI insight, records it in email_logs and verifies it was sent. Use ONLY when the owner explicitly asks for a report by email.",
  parameters: z.object({
    reportType: z.enum(["daily", "weekly"]),
  }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("send_report_email", [ADMIN_ROLE])],
  async execute(
    { reportType }: { reportType: "daily" | "weekly" },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;

    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "send_report_email",
        actionType: "reports.email.send",
        risk: "medium",
        summary: `Send ${reportType} report email`,
      },
      async () => {
        const send = await sendReportEmail({
          reportType,
          source: "ai",
          requestedBy: ctx.userId,
        });
        if (!send.ok) {
          return { ok: false, reason: "error", message: send.message } as const;
        }
        return asResult(async () => ({
          recipient: send.recipient,
          subject: send.subject,
          aiInsight: send.aiInsight,
          providerMessageId: send.providerMessageId,
        }));
      },
    );
    return result;
  },
});