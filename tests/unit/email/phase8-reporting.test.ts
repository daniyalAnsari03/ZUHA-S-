import { render } from "@react-email/components";
import { describe, expect, it } from "vitest";

import { salesAgent } from "@/agents/employees";
import DailyReportEmail from "@/emails/DailyReport";
import WeeklyReportEmail from "@/emails/WeeklyReport";
import { classifyEmailReportSend } from "@/guardians/email";
import {
  buildReportSubject,
  type DailySalesSummary,
  type WeeklySalesSummary,
} from "@/services/email/report-data-service";
import { generateReportInsight } from "@/services/email/report-insight-service";
import { ServiceError } from "@/services/base";
import {
  getDailySalesSummaryTool,
  getWeeklySalesSummaryTool,
  sendReportEmailTool,
} from "@/tools/reports";

/**
 * Phase 8 — email reporting engine tests.
 *
 * Pure logic + security-shape tests. No network, no database: recipient
 * resolution and provider sends are exercised by integration/QA scripts only.
 */

const dailySummary: DailySalesSummary = {
  reportType: "daily",
  dateKey: "2026-09-21",
  dateLabel: "Monday 21 September 2026",
  revenue: 45000,
  orderCount: 3,
  averageOrderValue: 15000,
  topProducts: [{ name: "Jamawar Classic", unitsSold: 2, revenue: 30000 }],
  lowStock: [{ id: "p1", name: "Lawn Print", stockQuantity: 2, lowStockThreshold: 5 }],
};

const weeklySummary: WeeklySalesSummary = {
  reportType: "weekly",
  weekStartKey: "2026-09-15",
  weekEndKey: "2026-09-21",
  weekLabel: "15 Sep — 21 Sep",
  revenue: 300000,
  previousRevenue: 200000,
  revenueGrowthPercent: 50,
  orderCount: 20,
  previousOrderCount: 15,
  bestSellers: [{ name: "Embroidered Kurta", unitsSold: 12, revenue: 180000 }],
  lowStock: [],
};

describe("classifyEmailReportSend", () => {
  it("allows the automated cron engine at low risk", () => {
    expect(classifyEmailReportSend("cron")).toEqual({
      allowed: true,
      risk: "low",
      requiresApproval: false,
    });
  });

  it("allows admin and AI sends at medium risk with no hard approval gate", () => {
    for (const source of ["admin", "ai"] as const) {
      const decision = classifyEmailReportSend(source);
      expect(decision.allowed).toBe(true);
      expect(decision.risk).toBe("medium");
      expect(decision.requiresApproval).toBe(false);
    }
  });

  it("blocks unknown/unverified send sources", () => {
    const decision = classifyEmailReportSend("unknown" as "ai");
    expect(decision.allowed).toBe(false);
    expect(decision.risk).toBe("high");
    expect(decision.requiresApproval).toBe(true);
  });
});

describe("buildReportSubject", () => {
  it("builds a daily subject from the real summary label", () => {
    expect(buildReportSubject("daily", dailySummary)).toBe(
      "DINS Daily Business Report — Monday 21 September 2026",
    );
  });

  it("builds a weekly subject from the real summary label", () => {
    expect(buildReportSubject("weekly", weeklySummary)).toBe(
      "DINS Weekly Business Report — 15 Sep — 21 Sep",
    );
  });

  it("falls back to a neutral subject on an unexpected mismatch", () => {
    expect(buildReportSubject("daily", weeklySummary)).toBe("DINS Business Report");
  });
});

describe("generateReportInsight fail-closed", () => {
  it("throws without calling the model when there is no data", async () => {
    await expect(generateReportInsight("daily", "  ")).rejects.toThrow(ServiceError);
    await expect(generateReportInsight("weekly", "")).rejects.toThrow(
      /No report data available/,
    );
  });
});

describe("report tools", () => {
  it("getDailySalesSummaryTool is defined with the correct name and description", () => {
    expect(getDailySalesSummaryTool.name).toBe("get_daily_sales_summary");
    expect(getDailySalesSummaryTool.description.length).toBeGreaterThan(10);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((getDailySalesSummaryTool as any).inputGuardrails).toBeDefined();
  });

  it("getWeeklySalesSummaryTool is defined with the correct name and description", () => {
    expect(getWeeklySalesSummaryTool.name).toBe("get_weekly_sales_summary");
    expect(getWeeklySalesSummaryTool.description.length).toBeGreaterThan(10);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((getWeeklySalesSummaryTool as any).inputGuardrails).toBeDefined();
  });

  it("sendReportEmailTool requires a reportType parameter", () => {
    expect(sendReportEmailTool.name).toBe("send_report_email");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((sendReportEmailTool as any).parameters).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((sendReportEmailTool as any).inputGuardrails).toBeDefined();
  });
});

describe("salesAgent report wiring", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolNames = (salesAgent.tools ?? []).map((t) => (t as any).name);

  it("exposes the daily and weekly summary tools to the Sales Employee", () => {
    expect(toolNames).toContain("get_daily_sales_summary");
    expect(toolNames).toContain("get_weekly_sales_summary");
  });

  it("exposes the send_report_email tool to the Sales Employee", () => {
    expect(toolNames).toContain("send_report_email");
  });
});

describe("report email templates", () => {
  it("renders the daily report to HTML with brand and real numbers", async () => {
    const html = await render(
      DailyReportEmail({
        dateLabel: dailySummary.dateLabel,
        revenue: dailySummary.revenue,
        orderCount: dailySummary.orderCount,
        averageOrderValue: dailySummary.averageOrderValue,
        topProducts: dailySummary.topProducts,
        lowStock: dailySummary.lowStock,
        aiInsight: "Strong day driven by Jamawar.",
      }),
    );
    expect(html).toContain("DINS");
    expect(html).toContain("Jamawar Classic");
    expect(html).toContain("Low Stock Alerts");
  });

  it("renders the weekly report to HTML with brand and growth", async () => {
    const html = await render(
      WeeklyReportEmail({
        weekLabel: weeklySummary.weekLabel,
        revenue: weeklySummary.revenue,
        previousRevenue: weeklySummary.previousRevenue,
        revenueGrowthPercent: weeklySummary.revenueGrowthPercent ?? 0,
        orderCount: weeklySummary.orderCount,
        previousOrderCount: weeklySummary.previousOrderCount,
        bestSellers: weeklySummary.bestSellers,
        lowStock: weeklySummary.lowStock,
        aiInsight: "Steady growth week to week.",
      }),
    );
    expect(html).toContain("DINS");
    expect(html).toContain("Embroidered Kurta");
    expect(html).toContain("Revenue vs Previous Week");
  });
});