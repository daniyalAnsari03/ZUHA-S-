import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type {
  Database,
  OrderStatus,
  PaymentStatus,
} from "@/lib/supabase/types";
import { toDateKey } from "@/lib/time";
import { assertRole, ServiceError } from "@/services/base";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type OrderItemWithOrder = OrderItemRow & {
  order: { status: OrderStatus; payment_status: PaymentStatus } | null;
};

export type AdminActor = { id: string; role: "admin" | "customer" };

/** Order fields fetched for admin analytics/dashboard snapshots. */
export type OrderSnapshotRow = Pick<
  OrderRow,
  | "id"
  | "status"
  | "payment_status"
  | "total"
  | "order_number"
  | "customer_name"
  | "created_at"
>;

export type OrderStatusDistribution = {
  status: OrderStatus;
  label: string;
  count: number;
};

export type SalesTrendPoint = {
  dateKey: string;
  label: string;
  revenue: number;
  orderCount: number;
};

export type TopProduct = {
  productId: string | null;
  productName: string;
  unitsSold: number;
  revenue: number;
};

export type DashboardData = {
  revenue: number;
  activeRevenue: number;
  ordersCount: number;
  activeOrderCount: number;
  customersCount: number;
  productsCount: number;
  activeProductsCount: number;
  lowStockProducts: {
    id: string;
    name: string;
    price: number;
    stockQuantity: number;
    lowStockThreshold: number;
  }[];
  statusDistribution: OrderStatusDistribution[];
  recentOrders: {
    id: string;
    orderNumber: string;
    customerName: string;
    total: number;
    status: OrderStatus;
    createdAt: string;
  }[];
};

export type SalesAnalyticsData = DashboardData & {
  averageOrderValue: number;
  topProducts: TopProduct[];
  salesTrend: SalesTrendPoint[];
  trendDays: number;
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Order Placed",
  confirmed: "Order Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

/**
 * Business revenue rule — used consistently across the admin dashboard,
 * analytics and customer spending:
 *
 *   Revenue = sum of `orders.total` for orders whose status is NOT `cancelled`
 *             and whose payment_status is NOT `failed` or `refunded`.
 *
 * Cancelled, failed and refunded orders are excluded so invalid and reversed
 * business value never inflates reported numbers.
 */
export function isExcludedFromRevenue(
  status: OrderStatus,
  paymentStatus: PaymentStatus,
): boolean {
  return (
    status === "cancelled" ||
    paymentStatus === "failed" ||
    paymentStatus === "refunded"
  );
}

/** Total revenue for an order set using the documented business rule. */
export function computeRevenue(
  orders: Pick<OrderRow, "total" | "status" | "payment_status">[],
): number {
  return orders
    .filter((o) => !isExcludedFromRevenue(o.status, o.payment_status))
    .reduce((sum, o) => sum + o.total, 0);
}

/** Count of orders that count toward business value (non-cancelled, not reversal). */
export function computeActiveOrderCount(
  orders: Pick<OrderRow, "status" | "payment_status">[],
): number {
  return orders.filter(
    (o) => !isExcludedFromRevenue(o.status, o.payment_status),
  ).length;
}

/** Distribution of all orders across every status (including zero counts). */
export function computeStatusDistribution(
  orders: Pick<OrderRow, "status">[],
): OrderStatusDistribution[] {
  const base = ORDER_STATUSES.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    count: 0,
  }));

  for (const order of orders) {
    const bucket = base.find((b) => b.status === order.status);
    if (bucket) bucket.count += 1;
  }

  return base;
}

/**
 * Per-day revenue/order trend for the last `days` days with zero-filled days.
 * Uses the server's local date for bucketing (consistent within a single deployment).
 */
export function computeSalesTrend(
  orders: Pick<
    OrderRow,
    "total" | "status" | "payment_status" | "created_at"
  >[],
  days = 14,
): SalesTrendPoint[] {
  const trend = new Map<string, SalesTrendPoint>();

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const dateKey = toDateKey(d);
    trend.set(dateKey, {
      dateKey,
      label: d.toLocaleDateString("en-PK", { month: "short", day: "numeric" }),
      revenue: 0,
      orderCount: 0,
    });
  }

  for (const order of orders) {
    if (isExcludedFromRevenue(order.status, order.payment_status)) continue;
    const dateKey = toDateKey(new Date(order.created_at));
    const point = trend.get(dateKey);
    if (point) {
      point.revenue += order.total;
      point.orderCount += 1;
    }
  }

  return Array.from(trend.values());
}

/**
 * Top products by revenue using snapshot order items. Only items belonging to
 * orders that count toward revenue are included (cancelled/failed excluded).
 */
export function computeTopProducts(
  items: Pick<
    OrderItemWithOrder,
    "product_id" | "product_name" | "quantity" | "subtotal" | "order"
  >[],
  limit = 5,
): TopProduct[] {
  const map = new Map<string, TopProduct>();

  for (const item of items) {
    const order = item.order ?? null;
    if (!order || isExcludedFromRevenue(order.status, order.payment_status)) {
      continue;
    }

    const key = item.product_id ?? item.product_name;
    const row = map.get(key) ?? {
      productId: item.product_id,
      productName: item.product_name,
      unitsSold: 0,
      revenue: 0,
    };
    row.unitsSold += item.quantity;
    row.revenue += item.subtotal;
    map.set(key, row);
  }

  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

/** Stats object used by the dashboard and analytics pages. */
export function computeStats(
  orders: OrderSnapshotRow[],
  customersCount: number,
  productsCount: number,
  activeProductsCount: number,
): Omit<DashboardData, "lowStockProducts"> {
  return {
    revenue: computeRevenue(orders),
    activeRevenue: computeRevenue(orders),
    ordersCount: orders.length,
    activeOrderCount: computeActiveOrderCount(orders),
    customersCount,
    productsCount,
    activeProductsCount,
    statusDistribution: computeStatusDistribution(
      orders.map((o) => ({ status: o.status })),
    ),
    recentOrders: [...orders]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 6)
      .map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        customerName: o.customer_name,
        total: o.total,
        status: o.status,
        createdAt: o.created_at,
      })),
  };
}

export async function fetchAdminSnapshot(actor: AdminActor): Promise<{
  orders: OrderSnapshotRow[];
  customersCount: number;
  productsCount: number;
  activeProductsCount: number;
  lowStockProducts: DashboardData["lowStockProducts"];
}> {
  assertRole(actor.role, ["admin"]);
  const supabase = await createSupabaseClient();

  const [ordersResult, customersResult, productsResult] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, status, payment_status, total, order_number, customer_name, created_at",
      ),
    supabase
      .from("profiles")
      .select("id", { count: "exact" })
      .eq("role", "customer"),
    supabase
      .from("products")
      .select(
        "id, name, price, stock_quantity, low_stock_threshold, is_active",
      ),
  ]);

  if (ordersResult.error) {
    throw new ServiceError(
      "ANALYTICS_ORDERS_FAILED",
      "Failed to load order data.",
      ordersResult.error,
    );
  }
  if (customersResult.error) {
    throw new ServiceError(
      "ANALYTICS_CUSTOMERS_FAILED",
      "Failed to load customer data.",
      customersResult.error,
    );
  }
  if (productsResult.error) {
    throw new ServiceError(
      "ANALYTICS_PRODUCTS_FAILED",
      "Failed to load product data.",
      productsResult.error,
    );
  }

  const products = (productsResult.data ?? []) as {
    id: string;
    name: string;
    price: number;
    stock_quantity: number;
    low_stock_threshold: number;
    is_active: boolean;
  }[];

  return {
    orders: (ordersResult.data ?? []) as OrderSnapshotRow[],
    customersCount: customersResult.count ?? 0,
    productsCount: products.length,
    activeProductsCount: products.filter((p) => p.is_active).length,
    lowStockProducts: products
      .filter((p) => p.is_active && p.stock_quantity <= p.low_stock_threshold)
      .sort((a, b) => a.stock_quantity - b.stock_quantity)
      .map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        stockQuantity: p.stock_quantity,
        lowStockThreshold: p.low_stock_threshold,
      })),
  };
}

/** Live dashboard metrics used by /admin and the admin overview. */
export async function getAdminDashboard(
  actor: AdminActor,
): Promise<DashboardData> {
  const snapshot = await fetchAdminSnapshot(actor);

  return {
    ...computeStats(
      snapshot.orders,
      snapshot.customersCount,
      snapshot.productsCount,
      snapshot.activeProductsCount,
    ),
    lowStockProducts: snapshot.lowStockProducts,
  };
}

/** Full analytics used by /admin/analytics. */
export async function getSalesAnalytics(
  actor: AdminActor,
  options?: { trendDays?: number; topProductLimit?: number },
): Promise<SalesAnalyticsData> {
  const trendDays = Math.max(7, Math.min(90, options?.trendDays ?? 14));
  const topProductLimit = Math.max(
    1,
    Math.min(20, options?.topProductLimit ?? 5),
  );

  assertRole(actor.role, ["admin"]);
  const supabase = await createSupabaseClient();

  const [snapshot, itemsResult] = await Promise.all([
    fetchAdminSnapshot(actor),
    supabase
      .from("order_items")
      .select("product_id, product_name, quantity, subtotal, order_id"),
  ]);

  if (itemsResult.error) {
    throw new ServiceError(
      "ANALYTICS_ITEMS_FAILED",
      "Failed to load order item data.",
      itemsResult.error,
    );
  }

  const items = (itemsResult.data ?? []) as Pick<
    OrderItemRow,
    "product_id" | "product_name" | "quantity" | "subtotal" | "order_id"
  >[];

  // Attach the order snapshot for each item so top-product revenue always
  // follows the documented revenue rule (cancelled/failed/refunded excluded).
  const orderById = new Map(snapshot.orders.map((o) => [o.id, o]));
  const joinedItems: Pick<
    OrderItemWithOrder,
    "product_id" | "product_name" | "quantity" | "subtotal" | "order"
  >[] = items.map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: item.quantity,
    subtotal: item.subtotal,
    order: orderById.get(item.order_id) ?? null,
  }));

  const base = computeStats(
    snapshot.orders,
    snapshot.customersCount,
    snapshot.productsCount,
    snapshot.activeProductsCount,
  );

  const activeOrders = snapshot.orders.filter(
    (o) => !isExcludedFromRevenue(o.status, o.payment_status),
  );

  return {
    ...base,
    lowStockProducts: snapshot.lowStockProducts,
    averageOrderValue:
      activeOrders.length > 0 ? base.revenue / activeOrders.length : 0,
    topProducts: computeTopProducts(joinedItems, topProductLimit),
    salesTrend: computeSalesTrend(snapshot.orders, trendDays),
    trendDays,
  };
}
