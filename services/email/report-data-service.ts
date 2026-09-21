import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { BUSINESS_TIMEZONE, todayKeyPKT } from "@/lib/time";
import { ServiceError } from "@/services/base";
import {
  computeTopProducts,
  isExcludedFromRevenue,
} from "@/services/analytics/analytics-service";

/**
 * Report data service.
 *
 * Builds the RAW aggregated business data used by the AI reporting engine and
 * exposed to the AI Sales Employee as the `get_daily_sales_summary` /
 * `get_weekly_sales_summary` tools (and reused by the cron/Admin send paths so
 * there is exactly one source of truth).
 *
 * SECURITY:
 *  - Reads go through the service-role client because this service is invoked
 *    by authorized server paths with no user session (cron, Admin server
 *    actions, guarded AI tools). It is server-only and must never be called
 *    with unverified input.
 *  - Callers must complete their own authorization (admin actor / cron auth)
 *    BEFORE calling here.
 *
 * TIME: All "today" / window bucketing uses Pakistan Time (PKT) so a daily
 * report at midnight PKT reflects the true business day.
 */

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export type ReportTopProduct = {
  name: string;
  unitsSold: number;
  revenue: number;
};

export type ReportLowStockItem = {
  name: string;
  stockQuantity: number;
  lowStockThreshold: number;
  id: string;
};

export type DailySalesSummary = {
  reportType: "daily";
  dateKey: string;
  dateLabel: string;
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
  topProducts: ReportTopProduct[];
  lowStock: ReportLowStockItem[];
};

export type WeeklySalesSummary = {
  reportType: "weekly";
  weekStartKey: string;
  weekEndKey: string;
  weekLabel: string;
  revenue: number;
  previousRevenue: number;
  revenueGrowthPercent: number | null;
  orderCount: number;
  previousOrderCount: number;
  bestSellers: ReportTopProduct[];
  lowStock: ReportLowStockItem[];
};

export type ReportSnapshot = {
  orders: OrderRow[];
  items: OrderItemRow[];
  products: ProductRow[];
};

function pktDateKey(iso: string): string {
  const d = new Date(iso);
  const wall = new Date(
    d.toLocaleString("en-US", { timeZone: BUSINESS_TIMEZONE }),
  );
  const y = wall.getFullYear();
  const m = String(wall.getMonth() + 1).padStart(2, "0");
  const day = String(wall.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function countsAsRevenue(
  order: Pick<OrderRow, "status" | "payment_status">,
): boolean {
  return !isExcludedFromRevenue(order.status, order.payment_status);
}

function toReportProducts(
  items: Pick<
    OrderItemRow,
    "product_id" | "product_name" | "quantity" | "subtotal" | "order_id"
  >[],
  orderById: Map<string, OrderRow>,
  limit: number,
): ReportTopProduct[] {
  const joined = items.map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: item.quantity,
    subtotal: item.subtotal,
    order: orderById.get(item.order_id) ?? null,
  }));

  return computeTopProducts(joined, limit).map((p) => ({
    name: p.productName,
    unitsSold: p.unitsSold,
    revenue: p.revenue,
  }));
}

function lowStockItems(products: ProductRow[]): ReportLowStockItem[] {
  return products
    .filter(
      (p) => p.is_active && p.stock_quantity <= p.low_stock_threshold,
    )
    .sort((a, b) => a.stock_quantity - b.stock_quantity)
    .map((p) => ({
      id: p.id,
      name: p.name,
      stockQuantity: p.stock_quantity,
      lowStockThreshold: p.low_stock_threshold,
    }));
}

export async function loadReportSnapshot(): Promise<ReportSnapshot> {
  const supabase = createAdminClient();

  const [ordersResult, itemsResult, productsResult] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, status, payment_status, total, order_number, customer_name, created_at, subtotal",
      ),
    supabase
      .from("order_items")
      .select("order_id, product_id, product_name, quantity, subtotal"),
    supabase
      .from("products")
      .select("id, name, stock_quantity, low_stock_threshold, is_active"),
  ]);

  if (ordersResult.error) {
    throw new ServiceError(
      "REPORT_ORDERS_FAILED",
      "Failed to load order data for the report.",
      ordersResult.error,
    );
  }
  if (itemsResult.error) {
    throw new ServiceError(
      "REPORT_ITEMS_FAILED",
      "Failed to load order item data for the report.",
      itemsResult.error,
    );
  }
  if (productsResult.error) {
    throw new ServiceError(
      "REPORT_PRODUCTS_FAILED",
      "Failed to load product data for the report.",
      productsResult.error,
    );
  }

  return {
    orders: (ordersResult.data ?? []) as OrderRow[],
    items: (itemsResult.data ?? []) as OrderItemRow[],
    products: (productsResult.data ?? []) as ProductRow[],
  };
}

const WEEKDAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function labelFor(pktKey: string): string {
  const [y, m, d] = pktKey.split("-").map(Number);
  return WEEKDAY_LABEL.format(new Date(y, m - 1, d));
}

function weekWindowKeys(): { startKey: string; endKey: string } {
  const start = new Date();
  const wall = new Date(
    start.toLocaleString("en-US", { timeZone: BUSINESS_TIMEZONE }),
  );
  wall.setHours(0, 0, 0, 0);
  wall.setDate(wall.getDate() - 6);
  const y = wall.getFullYear();
  const m = String(wall.getMonth() + 1).padStart(2, "0");
  const d = String(wall.getDate()).padStart(2, "0");
  return { startKey: `${y}-${m}-${d}`, endKey: todayKeyPKT() };
}

/**
 * Build today's (PKT) business summary: revenue, order count, average order
 * value, today's top products and low-stock alerts.
 */
export async function buildDailySalesSummary(): Promise<DailySalesSummary> {
  const snapshot = await loadReportSnapshot();
  const today = todayKeyPKT();

  const todayOrders = snapshot.orders.filter((o) => {
    if (pktDateKey(o.created_at) !== today) return false;
    return countsAsRevenue(o);
  });

  const revenue = todayOrders.reduce((sum, o) => sum + o.total, 0);

  const orderById = new Map(snapshot.orders.map((o) => [o.id, o]));
  const todayItems = snapshot.items.filter(
    (item) => pktDateKey(orderById.get(item.order_id)?.created_at ?? "") === today,
  );

  const topProducts = toReportProducts(todayItems, orderById, 3);

  return {
    reportType: "daily",
    dateKey: today,
    dateLabel: labelFor(today),
    revenue,
    orderCount: todayOrders.length,
    averageOrderValue:
      todayOrders.length > 0 ? revenue / todayOrders.length : 0,
    topProducts,
    lowStock: lowStockItems(snapshot.products),
  };
}

/**
 * Build the trailing 7-day (PKT) business summary with the revenue/order
 * growth over the previous 7-day window, plus best sellers and low stock.
 */
export async function buildWeeklySalesSummary(): Promise<WeeklySalesSummary> {
  const snapshot = await loadReportSnapshot();
  const { startKey, endKey } = weekWindowKeys();

  const inCurrent = (iso: string) =>
    pktDateKey(iso) >= startKey && pktDateKey(iso) <= endKey;
  const inPrevious = (iso: string) => {
    const key = pktDateKey(iso);
    return key >= shiftKey(startKey, -7) && key <= shiftKey(endKey, -7);
  };

  const currentOrders = snapshot.orders.filter(
    (o) => countsAsRevenue(o) && inCurrent(o.created_at),
  );
  const previousOrders = snapshot.orders.filter(
    (o) => countsAsRevenue(o) && inPrevious(o.created_at),
  );

  const revenue = currentOrders.reduce((sum, o) => sum + o.total, 0);
  const previousRevenue = previousOrders.reduce(
    (sum, o) => sum + o.total,
    0,
  );

  const orderById = new Map(snapshot.orders.map((o) => [o.id, o]));
  const currentItems = snapshot.items.filter((item) => {
    const order = orderById.get(item.order_id);
    if (!order) return false;
    return countsAsRevenue(order) && inCurrent(order.created_at);
  });

  const bestSellers = toReportProducts(currentItems, orderById, 5);

  const revenueGrowthPercent =
    previousRevenue > 0
      ? ((revenue - previousRevenue) / previousRevenue) * 100
      : revenue > 0
        ? 100
        : 0;

  return {
    reportType: "weekly",
    weekStartKey: startKey,
    weekEndKey: endKey,
    weekLabel: `${labelShort(startKey)} – ${labelShort(endKey)}`,
    revenue,
    previousRevenue,
    revenueGrowthPercent,
    orderCount: currentOrders.length,
    previousOrderCount: previousOrders.length,
    bestSellers,
    lowStock: lowStockItems(snapshot.products),
  };
}

function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, "0");
  const nd = String(date.getDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

function labelShort(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

/** Report subject lines built from real summary data. */
export function buildReportSubject(
  reportType: "daily" | "weekly",
  summary: DailySalesSummary | WeeklySalesSummary,
): string {
  if (reportType === "daily" && summary.reportType === "daily") {
    return `DINS Daily Business Report — ${summary.dateLabel}`;
  }
  if (reportType === "weekly" && summary.reportType === "weekly") {
    return `DINS Weekly Business Report — ${summary.weekLabel}`;
  }
  return "DINS Business Report";
}