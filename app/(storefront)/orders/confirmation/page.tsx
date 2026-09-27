import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Container } from "@/components/ui/container";
import { getAuthUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Order Confirmed",
  robots: { index: false, follow: false },
};

export default async function OrderConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const { ref } = await searchParams;

  if (!ref) {
    return (
      <main className="flex-1 bg-ivory">
        <Container size="md" className="py-20 text-center sm:py-28">
          <h1 className="font-serif text-2xl text-charcoal sm:text-3xl">
            No order reference found
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-charcoal-muted">
            Please check your order history for details.
          </p>
          <Link
            href="/orders"
            className="mt-8 inline-block rounded-lg bg-plum px-8 py-3 text-sm font-medium tracking-wide text-white transition-colors hover:bg-plum-dark"
          >
            View My Orders
          </Link>
        </Container>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-ivory">
      <Container size="md" className="py-20 text-center sm:py-28">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="mt-6 font-serif text-2xl text-charcoal sm:text-3xl">
          Order Placed Successfully
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-charcoal-muted">
          Thank you for your order. Your order reference is:
        </p>
        <p className="mt-4 font-mono text-lg font-semibold text-plum">{ref}</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-charcoal-muted">
          We&apos;ll send you updates as your order is processed. You can track
          your order status anytime from your account.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/orders"
            className="inline-block rounded-lg bg-plum px-8 py-3 text-sm font-medium tracking-wide text-white transition-colors hover:bg-plum-dark"
          >
            View My Orders
          </Link>
          <Link
            href="/shop"
            className="inline-block rounded-lg border border-charcoal/20 bg-transparent px-8 py-3 text-sm font-medium tracking-wide text-charcoal transition-colors hover:border-plum hover:text-plum"
          >
            Continue Shopping
          </Link>
        </div>
      </Container>
    </main>
  );
}
