import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

import { Container } from "@/components/ui/container";
import { getAuthUser } from "@/lib/auth/session";
import { resolveImageUrl } from "@/lib/images";
import { formatPrice } from "@/lib/storefront/format";
import { listCustomerOrders } from "@/services/orders/order-service";

export const metadata: Metadata = {
  title: "My Orders",
  robots: { index: false, follow: false },
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  processing: "bg-indigo-100 text-indigo-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function OrdersPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  let orders: Awaited<ReturnType<typeof listCustomerOrders>> = [];
  try {
    orders = await listCustomerOrders(user.id);
  } catch {
    orders = [];
  }

  return (
    <main className="flex-1 bg-ivory">
      <Container size="lg" className="py-10 sm:py-14">
        <p className="text-[11px] uppercase tracking-[0.32em] text-gold-muted">
          <Link href="/" className="transition-colors hover:text-plum">
            Home
          </Link>{" "}
          / My Orders
        </p>

        <h1 className="mt-3 font-serif text-2xl text-charcoal sm:text-3xl">
          My Orders
        </h1>

        {orders.length === 0 ? (
          <div className="mt-8 rounded-xl border border-charcoal/10 bg-white p-8 sm:p-10 text-center">
            <p className="text-sm text-charcoal-muted">
              You haven&apos;t placed any orders yet. Browse the collection and find
              something you love.
            </p>
            <Link
              href="/shop"
              className="mt-6 inline-block rounded-lg border border-charcoal/20 bg-transparent px-8 py-3 text-sm font-medium tracking-wide text-charcoal transition-colors hover:border-plum hover:text-plum"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <ul className="mt-8 divide-y divide-charcoal/5 overflow-hidden rounded-xl border border-charcoal/10 bg-white">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex flex-col gap-4 px-5 py-5 transition-colors hover:bg-cream/40 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                >
                  <div className="flex min-w-0 flex-1 gap-4">
                    {/* First item image */}
                    {order.items[0]?.product_image ? (
                      <div className="hidden h-16 w-14 shrink-0 overflow-hidden rounded-lg border border-charcoal/10 bg-cream sm:block">
                        <Image
                          src={resolveImageUrl(order.items[0].product_image) ?? ""}
                          alt={order.items[0].product_name}
                          width={112}
                          height={128}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : null}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <p className="font-mono text-sm font-medium text-charcoal">
                          {order.order_number}
                        </p>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-700"}`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-charcoal-muted">
                        {formatDate(order.created_at)} &middot; {order.items.length} item{order.items.length === 1 ? "" : "s"}
                      </p>
                      <p className="mt-1 text-xs text-charcoal-muted sm:hidden">
                        {formatPrice(order.total)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:flex-col sm:items-end">
                    <p className="text-sm font-medium text-charcoal">
                      {formatPrice(order.total)}
                    </p>
                    <span className="mt-1 text-xs font-medium text-plum">
                      View Details →
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </main>
  );
}
