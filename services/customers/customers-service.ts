import {
  createClient as createSupabaseClient,
} from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { assertRole, ServiceError } from "@/services/base";
import { isExcludedFromRevenue } from "@/services/analytics/analytics-service";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

export type AdminActor = { id: string; role: "admin" | "customer" };

export type CustomerListItem = {
  id: string;
  fullName: string | null;
  phone: string | null;
  city: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  orderCount: number;
  activeOrderCount: number;
  totalSpend: number;
  lastOrderAt: string | null;
};

export type CustomerDetail = {
  profile: ProfileRow;
  orders: Pick<
    OrderRow,
    | "id"
    | "order_number"
    | "status"
    | "payment_status"
    | "total"
    | "created_at"
  >[];
  orderCount: number;
  activeOrderCount: number;
  totalSpend: number;
  lastOrderAt: string | null;
};

/**
 * Aggregate customer orders into a spending summary. Mirrors the documented
 * revenue rule: cancelled / failed / refunded orders never count toward spend.
 */
export function computeCustomerSummary(
  orders: Pick<
    OrderRow,
    "id" | "status" | "payment_status" | "total" | "created_at"
  >[],
): { orderCount: number; activeOrderCount: number; totalSpend: number; lastOrderAt: string | null } {
  let orderCount = 0;
  let activeOrderCount = 0;
  let totalSpend = 0;
  let lastOrderAt: string | null = null;

  for (const order of orders) {
    orderCount += 1;
    if (!isExcludedFromRevenue(order.status, order.payment_status)) {
      activeOrderCount += 1;
      totalSpend += order.total;
    }
    if (!lastOrderAt || new Date(order.created_at) > new Date(lastOrderAt)) {
      lastOrderAt = order.created_at;
    }
  }

  return { orderCount, activeOrderCount, totalSpend, lastOrderAt };
}

/** Admin view of the customer base with search, ordering and pagination. */
export async function listCustomers(
  actor: AdminActor,
  options?: {
    search?: string;
    limit?: number;
    offset?: number;
  },
): Promise<{ customers: CustomerListItem[]; total: number }> {
  assertRole(actor.role, ["admin"]);

  const supabase = await createSupabaseClient();
  const limit = options?.limit ?? 25;
  const offset = options?.offset ?? 0;

  let query = supabase
    .from("profiles")
    .select("id, full_name, phone, city, created_at, updated_at", {
      count: "exact",
    })
    .eq("role", "customer");

  const search = options?.search?.trim();
  if (search) {
    const term = `%${search}%`;
    query = query.or(
      `full_name.ilike.${term},phone.ilike.${term},city.ilike.${term}`,
    );
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new ServiceError("CUSTOMERS_READ_FAILED", "Failed to load customers.", error);
  }

  const profiles = (data ?? []) as Pick<
    ProfileRow,
    "id" | "full_name" | "phone" | "city" | "created_at" | "updated_at"
  >[];

  if (profiles.length === 0) {
    return { customers: [], total: count ?? 0 };
  }

  // Batch-load order summary for the visible page (2 queries total, no N+1).
  const { data: orderRows, error: ordersError } = await supabase
    .from("orders")
    .select("user_id, id, status, payment_status, total, created_at")
    .in("user_id", profiles.map((p) => p.id));

  if (ordersError) {
    throw new ServiceError("CUSTOMERS_ORDERS_FAILED", "Failed to load customer orders.", ordersError);
  }

  const rows = (orderRows ?? []) as Pick<
    OrderRow,
    "id" | "status" | "payment_status" | "total" | "created_at" | "user_id"
  >[];

  const byUser = new Map<string, (typeof rows)[number][]>();
  for (const row of rows) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  const customers: CustomerListItem[] = profiles.map((profile) => {
    // Email is not stored on the profile; the latest order email is more
    // accurate for customer communications than guessing auth data.
    const summary = computeCustomerSummary(byUser.get(profile.id) ?? []);
    return {
      id: profile.id,
      fullName: profile.full_name,
      phone: profile.phone,
      city: profile.city,
      email: null,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
      orderCount: summary.orderCount,
      activeOrderCount: summary.activeOrderCount,
      totalSpend: summary.totalSpend,
      lastOrderAt: summary.lastOrderAt,
    };
  });

  return { customers, total: count ?? 0 };
}

/** Full customer detail including complete order history. */
export async function getCustomerDetail(
  actor: AdminActor,
  customerId: string,
): Promise<CustomerDetail | null> {
  assertRole(actor.role, ["admin"]);

  const supabase = await createSupabaseClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", customerId)
    .eq("role", "customer")
    .maybeSingle();

  if (profileError) {
    throw new ServiceError("CUSTOMER_READ_FAILED", "Failed to load customer.", profileError);
  }

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, payment_status, total, created_at, customer_name, customer_phone, customer_email, city",
    )
    .eq("user_id", customerId)
    .order("created_at", { ascending: false });

  if (ordersError) {
    throw new ServiceError("CUSTOMER_ORDERS_FAILED", "Failed to load customer orders.", ordersError);
  }

  const orderRows = (orders ?? []) as unknown as Array<
    Pick<
      OrderRow,
      "id" | "order_number" | "status" | "payment_status" | "total" | "created_at"
    > & {
      customer_name: string;
      customer_phone: string;
      customer_email: string;
      city: string;
    }
  >;

  // A customer reachable from the admin Orders flow (via orders.user_id) may
  // not have a profiles row yet (e.g. profile creation failed or historical
  // data). Fall back to the order snapshot instead of returning a 404.
  if (!profile && orderRows.length === 0) return null;

  const resolvedProfile: ProfileRow = profile ?? {
    id: customerId,
    role: "customer",
    full_name: orderRows[0].customer_name || null,
    phone: orderRows[0].customer_phone || null,
    address: null,
    city: orderRows[0].city || null,
    postal_code: null,
    // Member since = their first order; most recent order as "updated".
    created_at: orderRows[orderRows.length - 1].created_at,
    updated_at: orderRows[0].created_at,
  };

  const summary = computeCustomerSummary(orderRows);

  return {
    profile: resolvedProfile,
    orders: orderRows,
    orderCount: summary.orderCount,
    activeOrderCount: summary.activeOrderCount,
    totalSpend: summary.totalSpend,
    lastOrderAt: summary.lastOrderAt,
  };
}