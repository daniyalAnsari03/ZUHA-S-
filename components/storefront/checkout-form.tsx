"use client";

import Image from "next/image";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/storefront/format";
import { initiateCheckoutAction } from "@/app/storefront/actions";

const checkoutSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Full name is required.")
    .max(120, "Name must be 120 characters or fewer."),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required.")
    .regex(
      /^(\+?92|0)?3\d{9}$/,
      "Enter a valid Pakistani mobile number (e.g. 0300 1234567).",
    ),
  email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
  shippingAddress: z
    .string()
    .trim()
    .min(1, "Shipping address is required.")
    .max(300, "Shipping address must be 300 characters or fewer."),
  city: z
    .string()
    .trim()
    .min(1, "City is required.")
    .max(80, "City must be 80 characters or fewer."),
  postalCode: z.string().trim().max(20, "Postal/area code must be 20 characters or fewer.").optional(),
  orderNotes: z.string().trim().max(1000, "Order notes must be 1000 characters or fewer.").optional(),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

type CheckoutItem = {
  id: string;
  name: string;
  slug: string;
  price: number;
  image: string | null;
  fabric: string | null;
  quantity: number;
  subtotal: number;
};

type CheckoutFormProps = {
  itemCount: number;
  totals: { itemCount: number; subtotal: number; shipping: number; total: number };
  items: CheckoutItem[];
};

type HandoffState = {
  tone: "ok" | "error" | "info";
  message: string;
  reference?: string;
  totals?: { itemCount: number; subtotal: number; shipping: number; total: number };
};

/**
 * Secure checkout foundation (Phase 4). Validation, pricing and the payment
 * handoff state are always resolved server-side; the client never submits a
 * total. No fake payment success is ever displayed.
 */
export function CheckoutForm({ itemCount, totals: initialTotals, items }: CheckoutFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
  });

  const [handoff, setHandoff] = useState<HandoffState | null>(null);
  const [liveTotals, setLiveTotals] = useState(initialTotals);

  const onSubmit = handleSubmit(async (values) => {
    setHandoff(null);

    const result = await initiateCheckoutAction(values);

    if (!result.ok) {
      setHandoff({ tone: "error", message: result.errors.join(" ") });
      return;
    }

    setLiveTotals(result.totals);
    setHandoff({
      tone: result.state === "unavailable" ? "info" : "ok",
      message: result.message,
      reference: result.reference,
      totals: result.totals,
    });
  });

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
        <fieldset className="flex flex-col gap-5">
          <legend className="text-[11px] uppercase tracking-[0.28em] text-charcoal">
            Contact details
          </legend>

          <div>
            <label
              htmlFor="checkout-name"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-muted"
            >
              Full name
            </label>
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Input
                  id="checkout-name"
                  placeholder="Your full name"
                  autoComplete="name"
                  invalid={!!errors.name}
                  {...field}
                />
              )}
            />
            {errors.name ? (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="checkout-phone"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-muted"
              >
                Phone number
              </label>
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <Input
                    id="checkout-phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="0300 1234567"
                    autoComplete="tel"
                    invalid={!!errors.phone}
                    {...field}
                  />
                )}
              />
              {errors.phone ? (
                <p role="alert" className="mt-1 text-xs text-red-600">
                  {errors.phone.message}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="checkout-email"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-muted"
              >
                Email
              </label>
              <Controller
                control={control}
                name="email"
                render={({ field }) => (
                  <Input
                    id="checkout-email"
                    type="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    invalid={!!errors.email}
                    {...field}
                  />
                )}
              />
              {errors.email ? (
                <p role="alert" className="mt-1 text-xs text-red-600">
                  {errors.email.message}
                </p>
              ) : null}
            </div>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-5">
          <legend className="text-[11px] uppercase tracking-[0.28em] text-charcoal">
            Shipping address
          </legend>

          <div>
            <label
              htmlFor="checkout-address"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-muted"
            >
              Street address
            </label>
            <Controller
              control={control}
              name="shippingAddress"
              render={({ field }) => (
                <Input
                  id="checkout-address"
                  placeholder="House, street, area"
                  autoComplete="street-address"
                  invalid={!!errors.shippingAddress}
                  {...field}
                />
              )}
            />
            {errors.shippingAddress ? (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {errors.shippingAddress.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="checkout-city"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-muted"
              >
                City
              </label>
              <Controller
                control={control}
                name="city"
                render={({ field }) => (
                  <Input
                    id="checkout-city"
                    placeholder="City"
                    autoComplete="address-level2"
                    invalid={!!errors.city}
                    {...field}
                  />
                )}
              />
              {errors.city ? (
                <p role="alert" className="mt-1 text-xs text-red-600">
                  {errors.city.message}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="checkout-postal"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-muted"
              >
                Postal / area code
              </label>
              <Controller
                control={control}
                name="postalCode"
                render={({ field }) => (
                  <Input
                    id="checkout-postal"
                    placeholder="Optional"
                    autoComplete="postal-code"
                    invalid={!!errors.postalCode}
                    {...field}
                  />
                )}
              />
              {errors.postalCode ? (
                <p role="alert" className="mt-1 text-xs text-red-600">
                  {errors.postalCode.message}
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <label
              htmlFor="checkout-notes"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-muted"
            >
              Order notes
            </label>
            <textarea
              id="checkout-notes"
              rows={4}
              placeholder="Anything we should know about your order (optional)"
              aria-invalid={!!errors.orderNotes || undefined}
              {...register("orderNotes")}
              className="w-full rounded-lg border border-charcoal/15 bg-white px-4 py-3 text-sm text-charcoal placeholder:text-charcoal-muted/60 transition-colors focus:border-plum focus:outline-none focus:ring-2 focus:ring-plum/15 disabled:opacity-50"
            />
            {errors.orderNotes ? (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {errors.orderNotes.message}
              </p>
            ) : null}
          </div>
        </fieldset>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={isSubmitting}
          className="w-full lg:w-auto"
        >
          {isSubmitting ? "Validating…" : "Place Order"}
        </Button>

        {handoff ? (
          <div
            role="status"
            className={`rounded-lg border px-4 py-3.5 text-sm leading-relaxed ${
              handoff.tone === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : handoff.tone === "info"
                  ? "border-charcoal/10 bg-cream text-charcoal"
                  : "border-green-200 bg-green-50 text-green-800"
            }`}
          >
            <p className="font-medium">{handoff.message}</p>
            {handoff.totals ? (
              <p className="mt-2 text-xs text-charcoal-muted">
                Server-verified total: {formatPrice(handoff.totals.total)} (
                {handoff.totals.itemCount}{" "}
                {handoff.totals.itemCount === 1 ? "item" : "items"}). No order was
                created in this phase.
              </p>
            ) : null}
          </div>
        ) : null}
      </form>

      <aside className="lg:mt-2">
        <OrderSummary itemCount={itemCount} totals={liveTotals} items={items} />
      </aside>
    </>
  );
}

function OrderSummary({
  itemCount,
  totals,
  items,
}: {
  itemCount: number;
  totals: { itemCount: number; subtotal: number; shipping: number; total: number };
  items: CheckoutItem[];
}) {
  return (
    <div className="rounded-2xl border border-charcoal/10 bg-white p-5 sm:p-6">
      <h2 className="font-serif text-lg text-charcoal">Order summary</h2>
      <p className="mt-1 text-xs uppercase tracking-wide text-charcoal-muted">
        {itemCount} {itemCount === 1 ? "item" : "items"}
      </p>

      <ul className="mt-5 flex max-h-72 flex-col gap-4 overflow-y-auto">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3">
            <Link
              href={`/product/${encodeURIComponent(item.slug)}`}
              className="block h-16 w-14 shrink-0 overflow-hidden rounded-md border border-charcoal/10 bg-cream"
            >
              {item.image ? (
                <Image
                  src={item.image}
                  alt={item.name}
                  width={112}
                  height={128}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="truncate font-serif text-sm text-charcoal">{item.name}</p>
              {item.fabric ? (
                <p className="text-[11px] uppercase tracking-wide text-charcoal-muted">
                  {item.fabric}
                </p>
              ) : null}
              <p className="text-xs text-charcoal-muted">Qty {item.quantity}</p>
            </div>
            <p className="text-sm font-medium text-charcoal">
              {formatPrice(item.subtotal)}
            </p>
          </li>
        ))}
      </ul>

      <dl className="mt-6 flex flex-col gap-2 border-t border-charcoal/10 pt-5 text-sm text-charcoal">
        <div className="flex items-center justify-between">
          <dt className="text-charcoal-muted">Subtotal</dt>
          <dd className="font-medium">{formatPrice(totals.subtotal)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-charcoal-muted">Shipping</dt>
          <dd className="font-medium">
            {totals.shipping === 0 ? "Free" : formatPrice(totals.shipping)}
          </dd>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-charcoal/10 pt-3 text-base">
          <dt className="font-medium text-charcoal">Total</dt>
          <dd className="font-semibold text-plum">{formatPrice(totals.total)}</dd>
        </div>
      </dl>

      <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-charcoal-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-plum" aria-hidden="true" />
        Totals are verified on the server. Prices, stock and eligibility are
        re-checked at the moment of ordering.
      </p>
    </div>
  );
}