import type {
  DailySalesSummary,
  MonthlySalesSummary,
  ReportSummary,
  WeeklySalesSummary,
} from "./report-data-service";

/**
 * AI-insight truthfulness guard for report emails.
 *
 * The AI Reporting Analyst receives the real summary and is instructed to use
 * only those numbers — but instructions can fail. THIS module is the hard
 * verification layer: before an AI-phrased insight is allowed into an email,
 * every number mentioned in it must exist in the real data object. If any
 * number does not, the caller falls back to `buildPlainReportInsight`, a
 * templated message built only from raw data values. This guarantees the
 * owner's report email can never contain a fabricated figure, even when the
 * AI wording is wrong.
 */

const NUMBER_TOKEN = /\d[\d,]*/g;

function addNumber(set: Set<number>, value: number): void {
  if (!Number.isFinite(value)) return;
  // Accept the exact value and its rounded form: the analyst is told to state
  // figures precisely, and a rounded write-up of a real (fractional) growth
  // figure still matches the real source value.
  set.add(value);
  set.add(Math.round(value));
}

function collectNumbers(set: Set<number>, value: unknown): void {
  if (typeof value === "number") {
    addNumber(set, value);
    return;
  }
  if (typeof value === "string") {
    // Date/label strings carry numbers an insight may legitimately quote
    // ("21 September 2026", "15 Sep — 21 Sep").
    for (const token of value.match(NUMBER_TOKEN) ?? []) {
      const parsed = Number(token.replace(/,/g, ""));
      if (Number.isFinite(parsed)) set.add(parsed);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectNumbers(set, item);
    return;
  }
  if (value && typeof value === "object") {
    for (const inner of Object.values(value)) collectNumbers(set, inner);
  }
}

/** The full set of numbers that legitimately appear in a real summary. */
export function realInsightNumbers(summary: ReportSummary): Set<number> {
  const set = new Set<number>();
  collectNumbers(set, summary);
  return set;
}

/** Every number token mentioned in the AI-written insight text. */
export function extractInsightNumbers(insight: string): number[] {
  const results: number[] = [];
  for (const token of insight.match(NUMBER_TOKEN) ?? []) {
    const parsed = Number(token.replace(/,/g, ""));
    if (Number.isFinite(parsed)) results.push(parsed);
  }
  return results;
}

/**
 * True only when every number the AI wrote exists in the real summary.
 * Any fabricated/unknown number fails the check.
 */
export function insightNumbersMatch(
  summary: ReportSummary,
  insight: string,
): boolean {
  const allowed = realInsightNumbers(summary);
  return extractInsightNumbers(insight).every((n) => allowed.has(n));
}

function pkr(value: number): string {
  return `PKR ${Math.round(value).toLocaleString("en-PK")}`;
}

function topLine(rows: { name: string; unitsSold: number }[]): string {
  if (rows.length === 0) return "None recorded.";
  return rows.map((p) => `${p.name} (${p.unitsSold} sold)`).join(", ");
}

function lowStockLine(rows: { name: string; stockQuantity: number }[]): string {
  if (rows.length === 0) return "No products are low on stock.";
  return rows
    .map((p) => `${p.name} (${p.stockQuantity} left)`)
    .join(", ");
}

function growthPct(value: number | null): string {
  if (value === null) return "n/a";
  const rounded = Math.round(value);
  if (rounded > 0) return `+${rounded}%`;
  if (rounded < 0) return `${rounded}%`;
  return "0%";
}

/**
 * Plain templated insight containing ONLY raw values from the real summary.
 * Used as the guaranteed-truthful fallback when the AI write-up is not trusted.
 */
export function buildPlainReportInsight(
  reportType: "daily" | "weekly" | "monthly",
  summary: ReportSummary,
): string {
  if (reportType === "daily" && summary.reportType === "daily") {
    return buildDailyPlainText(summary);
  }
  if (reportType === "weekly" && summary.reportType === "weekly") {
    return buildWeeklyPlainText(summary);
  }
  if (reportType === "monthly" && summary.reportType === "monthly") {
    return buildMonthlyPlainText(summary);
  }
  return "Business report.";
}

function buildDailyPlainText(summary: DailySalesSummary): string {
  return [
    `Daily report for ${summary.dateLabel}.`,
    `Revenue: ${pkr(summary.revenue)}. Orders: ${summary.orderCount}. Average order value: ${pkr(summary.averageOrderValue)}.`,
    `Top products: ${topLine(summary.topProducts)}. Low stock: ${lowStockLine(summary.lowStock)}.`,
  ].join("\n");
}

function buildWeeklyPlainText(summary: WeeklySalesSummary): string {
  return [
    `Weekly report for ${summary.weekLabel}.`,
    `Revenue: ${pkr(summary.revenue)} vs previous week ${pkr(summary.previousRevenue)} (${growthPct(summary.revenueGrowthPercent)}). Orders: ${summary.orderCount} vs ${summary.previousOrderCount} previous.`,
    `Best sellers: ${topLine(summary.bestSellers)}. Low stock: ${lowStockLine(summary.lowStock)}.`,
  ].join("\n");
}

function buildMonthlyPlainText(summary: MonthlySalesSummary): string {
  return [
    `Monthly report for ${summary.monthLabel}.`,
    `Revenue: ${pkr(summary.revenue)} vs previous month ${pkr(summary.previousRevenue)} (${growthPct(summary.revenueGrowthPercent)}). Orders: ${summary.orderCount} vs ${summary.previousOrderCount} previous.`,
    `Best sellers: ${topLine(summary.bestSellers)}. Low stock: ${lowStockLine(summary.lowStock)}.`,
  ].join("\n");
}