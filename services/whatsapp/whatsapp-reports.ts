import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderStatus, PaymentStatus } from "@/lib/supabase/types";
import { todayKeyPKT, toDateKey } from "@/lib/time";
import {
  computeSalesTrend,
  computeStatusDistribution,
  STATUS_LABELS,
  type SalesTrendPoint,
  type TopProduct,
} from "@/services/analytics/analytics-service";

/**
 * WhatsApp report builders.
 *
 * Every report is derived from REAL business data via the service-role client,
 * never from hard-coded or AI-estimated figures. The revenue rule matches the
 * analytics service (orders whose status is not `cancelled` and whose
 * payment_status is not `failed`/`refunded`).
 */

type SnapshotOrder = {
  id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total: number;
  order_number: string | null;
  customer_name: string | null;
  created_at: string;
};

export type WhatsAppReport = {
  title: string;
  lines: string[];
};

const PKR = (value: number): string => `PKR ${Math.round(value).toLocaleString("en-PK")}`;

async function loadSnapshot(): Promise<{
  orders: SnapshotOrder[];
  lowStock: { id: string; name: string; stock_quantity: number; low_stock_threshold: number }[];
}> {
  const supabase = createAdminClient();
  const [ordersResult, productsResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, status, payment_status, total, order_number, customer_name, created_at"),
    supabase
      .from("products")
      .select("id, name, stock_quantity, low_stock_threshold, is_active"),
  ]);

  const orders = (ordersResult.data ?? []) as unknown as SnapshotOrder[];

  const allProducts = (productsResult.data ?? []) as unknown as {
    id: string;
    name: string;
    stock_quantity: number;
    low_stock_threshold: number;
    is_active: boolean;
  }[];

  const lowStock = allProducts
    .filter((p) => p.is_active && p.stock_quantity <= p.low_stock_threshold)
    .sort((a, b) => a.stock_quantity - b.stock_quantity)
    .map((p) => ({
      id: p.id,
      name: p.name,
      stock_quantity: p.stock_quantity,
      low_stock_threshold: p.low_stock_threshold,
    }));

  return { orders, lowStock };
}

/** Daily sales report (today, Pakistan time), plus trend context. */
export async function buildDailySalesReport(): Promise<WhatsAppReport> {
  const { orders } = await loadSnapshot();
  const today = todayKeyPKT();
  const trend = computeSalesTrend(orders, 14);
  const todayPoint = trend.find((t) => t.dateKey === today);

  const lines: string[] = [];
  lines.push(`Daily Sales — ${today}`);
  lines.push(`Revenue: ${PKR(todayPoint?.revenue ?? 0)}`);
  lines.push(`Orders: ${todayPoint?.orderCount ?? 0}`);
  lines.push("");
  lines.push("Status breakdown (all orders):");
  for (const bucket of computeStatusDistribution(orders)) {
    if (bucket.count > 0) {
      lines.push(`- ${STATUS_LABELS[bucket.status]}: ${bucket.count}`);
    }
  }
  return { title: "Daily Sales Report", lines };
}

/** Live low-stock report. Never invents stock figures. */
export async function buildLowStockReport(): Promise<WhatsAppReport> {
  const { lowStock } = await loadSnapshot();
  const lines: string[] = [];
  if (lowStock.length === 0) {
    lines.push("No products are low on stock right now.");
    return { title: "Low Stock Report", lines };
  }
  lines.push(`${lowStock.length} product(s) low on stock:`);
  for (const product of lowStock) {
    lines.push(
      `- ${product.name}: ${product.stock_quantity} left (threshold ${product.low_stock_threshold})`,
    );
  }
  return { title: "Low Stock Report", lines };
}

/** Recent order summary with real order numbers, statuses and totals. */
export async function buildOrdersReport(limit = 5): Promise<WhatsAppReport> {
  const safeLimit = Math.min(Math.max(limit, 1), 10);
  const { orders } = await loadSnapshot();
  const recent = [...orders]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, safeLimit);

  const lines: string[] = [];
  if (recent.length === 0) {
    lines.push("No orders yet.");
    return { title: "Recent Orders", lines };
  }
  lines.push(`Latest ${recent.length} order(s):`);
  for (const order of recent) {
    lines.push(
      `- ${order.order_number ?? "—"} | ${order.customer_name ?? "—"} | ${STATUS_LABELS[order.status]} | ${PKR(order.total)}`,
    );
  }
  return { title: "Recent Orders", lines };
}

/** Simple serializer for sending a report over WhatsApp. */
export function reportToText(report: WhatsAppReport): string {
  return [report.title ? `*${report.title}*` : "", ...report.lines]
    .filter((line) => line.length > 0)
    .join("\n");
}

/** Re-export for tool use: today's trend point lookup helper. */
export type { SalesTrendPoint, TopProduct };
export { toDateKey };