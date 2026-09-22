import { render } from "@react-email/components";
import { describe, expect, it } from "vitest";

import { salesAgent } from "@/agents/employees";
import DailyReportEmail from "@/emails/DailyReport";
import MonthlyReportEmail from "@/emails/MonthlyReport";
import WeeklyReportEmail from "@/emails/WeeklyReport";
import { classifyEmailReportSend } from "@/guardians/email";
import {
  buildReportSubject,
  reportPeriodKey,
  type DailySalesSummary,
  type MonthlySalesSummary,
  type WeeklySalesSummary,
} from "@/services/email/report-data-service";
import {
  buildPlainReportInsight,
  extractInsightNumbers,
  insightNumbersMatch,
} from "@/services/email/insight-sanitization";
import { generateReportInsight } from "@/services/email/report-insight-service";
import { ServiceError } from "@/services/base";
import { crossedToOutOfStock } from "@/services/notifications/notification-service";
import {
  getDailySalesSummaryTool,
  getMonthlySalesSummaryTool,
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

const monthlySummary: MonthlySalesSummary = {
  reportType: "monthly",
  monthKey: "2026-09",
  monthLabel: "September 2026",
  revenue: 1200000,
  previousRevenue: 900000,
  revenueGrowthPercent: 33.333,
  orderCount: 80,
  previousOrderCount: 65,
  bestSellers: [{ name: "Jamawar Classic", unitsSold: 24, revenue: 480000 }],
  lowStock: [{ id: "p9", name: "Lawn Print", stockQuantity: 1, lowStockThreshold: 5 }],
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

  it("builds a monthly subject from the real summary label", () => {
    expect(buildReportSubject("monthly", monthlySummary)).toBe(
      "DINS Monthly Business Report — September 2026",
    );
  });

  it("falls back to a neutral subject on an unexpected mismatch", () => {
    expect(buildReportSubject("daily", weeklySummary)).toBe("DINS Business Report");
  });
});

describe("reportPeriodKey", () => {
  it("returns a stable per-period key in the expected shape", () => {
    expect(reportPeriodKey("daily")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(reportPeriodKey("weekly")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(reportPeriodKey("monthly")).toMatch(/^\d{4}-\d{2}$/);
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

describe("insight number truthfulness guard", () => {
  it("accepts an AI insight whose every number exists in the real summary", () => {
    const insight =
      "Revenue today was PKR 45,000 across 3 orders. Jamawar Classic sold 2 units. Lawn Print has 2 left.";
    expect(insightNumbersMatch(dailySummary, insight)).toBe(true);
  });

  it("rejects an insight mentioning a number not in the real summary", () => {
    const insight =
      "Revenue today was PKR 999,999 across 3 orders.";
    expect(insightNumbersMatch(dailySummary, insight)).toBe(false);
  });

  it("accepts a rounded write-up of a real fractional growth figure", () => {
    const insight =
      "Monthly revenue grew 33% to PKR 1,200,000. Orders rose from 65 to 80.";
    expect(insightNumbersMatch(monthlySummary, insight)).toBe(true);
  });

  it("extracts only the numeric tokens from raw insight text", () => {
    expect(extractInsightNumbers("Revenue PKR 45,000, 3 orders, +50%.")).toEqual([
      45000, 3, 50,
    ]);
  });

  it("plain fallback contains only raw numbers, never AI phrasing", () => {
    const text = buildPlainReportInsight("daily", dailySummary);
    expect(text).toContain("PKR 45,000");
    expect(text).toContain("Orders: 3");
    expect(text).toContain("Average order value: PKR 15,000");
    expect(text).toContain("Jamawar Classic (2 sold)");
  });

  it("weekly and monthly plain fallbacks carry the raw growth numbers", () => {
    const weeklyText = buildPlainReportInsight("weekly", weeklySummary);
    expect(weeklyText).toContain("PKR 300,000");
    expect(weeklyText).toContain("(+50%)");
    expect(weeklyText).toContain("Orders: 20 vs 15 previous");

    const monthlyText = buildPlainReportInsight("monthly", monthlySummary);
    expect(monthlyText).toContain("PKR 1,200,000");
    expect(monthlyText).toContain("(+33%)");
    expect(monthlyText).toContain("Lawn Print (1 left)");
  });
});

describe("out-of-stock alert guard", () => {
  it("fires only when stock hits exactly 0 from a positive value", () => {
    expect(crossedToOutOfStock(5, 0)).toBe(true);
    expect(crossedToOutOfStock(1, 0)).toBe(true);
    expect(crossedToOutOfStock(0, 0)).toBe(false);
    expect(crossedToOutOfStock(5, 2)).toBe(false);
    expect(crossedToOutOfStock(0, 5)).toBe(false);
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

  it("getMonthlySalesSummaryTool is defined with the correct name", () => {
    expect(getMonthlySalesSummaryTool.name).toBe("get_monthly_sales_summary");
    expect(getMonthlySalesSummaryTool.description).toMatch(/month/i);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((getMonthlySalesSummaryTool as any).inputGuardrails).toBeDefined();
  });

  it("sendReportEmailTool requires a reportType parameter", () => {
    expect(sendReportEmailTool.name).toBe("send_report_email");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((sendReportEmailTool as any).parameters).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((sendReportEmailTool as any).inputGuardrails).toBeDefined();
  });

  it("sendReportEmailTool accepts the monthly report type", () => {
    expect(sendReportEmailTool.name).toBe("send_report_email");
    expect(sendReportEmailTool.description).toMatch(/monthly/);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reportTypeSchema = (sendReportEmailTool as any).parameters?.properties
      ?.reportType as { enum?: string[] } | undefined;
    expect(reportTypeSchema?.enum).toContain("daily");
    expect(reportTypeSchema?.enum).toContain("weekly");
    expect(reportTypeSchema?.enum).toContain("monthly");
  });
});

describe("salesAgent report wiring", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolNames = (salesAgent.tools ?? []).map((t) => (t as any).name);

  it("exposes the daily, weekly and monthly summary tools to the Sales Employee", () => {
    expect(toolNames).toContain("get_daily_sales_summary");
    expect(toolNames).toContain("get_weekly_sales_summary");
    expect(toolNames).toContain("get_monthly_sales_summary");
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

  it("renders the monthly report to HTML with brand, growth and best sellers", async () => {
    const html = await render(
      MonthlyReportEmail({
        monthLabel: monthlySummary.monthLabel,
        revenue: monthlySummary.revenue,
        previousRevenue: monthlySummary.previousRevenue,
        revenueGrowthPercent: monthlySummary.revenueGrowthPercent ?? 0,
        orderCount: monthlySummary.orderCount,
        previousOrderCount: monthlySummary.previousOrderCount,
        bestSellers: monthlySummary.bestSellers,
        lowStock: monthlySummary.lowStock,
        aiInsight: "Monthly growth is solid.",
      }),
    );
    expect(html).toContain("DINS");
    expect(html).toContain("September 2026");
    expect(html).toContain("Jamawar Classic");
    expect(html).toContain("Revenue vs Previous Month");
    expect(html).toContain("Low Stock Alerts");
    expect(html).toContain("Lawn Print");
  });
});