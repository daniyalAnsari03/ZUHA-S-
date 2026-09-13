import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CheckoutForm } from "@/components/storefront/checkout-form";

const mocks = vi.hoisted(() => ({
  initiateCheckout: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.routerPush }),
  usePathname: () => "/checkout",
}));

vi.mock("@/app/storefront/actions", () => ({
  initiateCheckoutAction: mocks.initiateCheckout,
}));

const props = {
  itemCount: 2,
  totals: { itemCount: 2, subtotal: 69000, shipping: 0, total: 69000 },
  items: [
    {
      id: "item-1",
      name: "Khirke Jamawar",
      slug: "khirke-jamawar",
      price: 34500,
      image: "/images/placeholders/product-1.svg",
      fabric: null,
      quantity: 2,
      subtotal: 69000,
    },
  ],
};

async function fillValidCheckout(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/full name/i), "Ali Raza");
  await user.type(screen.getByLabelText(/phone number/i), "03001234567");
  await user.type(screen.getByLabelText(/email/i), "ali@example.com");
  await user.type(screen.getByLabelText(/street address/i), "House 44, Main Boulevard");
  await user.type(screen.getByLabelText(/city/i), "Lahore");
}

describe("CheckoutForm", () => {
  it("shows an authoritative order summary", () => {
    render(<CheckoutForm {...props} />);

    expect(screen.getByText("Order summary")).toBeInTheDocument();
    expect(screen.getAllByText("PKR 69,000").length).toBeGreaterThan(0);
    expect(screen.getByText(/Totals are verified on the server/i)).toBeInTheDocument();
  });

  it("rejects an invalid Pakistani phone without submitting", async () => {
    const user = userEvent.setup();
    render(<CheckoutForm {...props} />);

    await fillValidCheckout(user);
    await user.clear(screen.getByLabelText(/phone number/i));
    await user.type(screen.getByLabelText(/phone number/i), "12345");

    await user.click(screen.getByRole("button", { name: "Place Order" }));

    expect(
      await screen.findByText(/enter a valid pakistani mobile number/i),
    ).toBeInTheDocument();
    expect(mocks.initiateCheckout).not.toHaveBeenCalled();
  });

  it("surfaces the safe unavailable-payment state (never a fake success)", async () => {
    mocks.initiateCheckout.mockResolvedValue({
      ok: true,
      state: "unavailable",
      reference: "CHK-123",
      message: "Payment is not configured yet. Your bag and details are validated, but no order was created.",
      totals: { itemCount: 2, subtotal: 69000, shipping: 0, total: 69000 },
    });

    const user = userEvent.setup();
    render(<CheckoutForm {...props} />);

    await fillValidCheckout(user);
    await user.click(screen.getByRole("button", { name: "Place Order" }));

    expect(mocks.initiateCheckout).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(/payment is not configured yet/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/no order was created/i).length).toBeGreaterThan(0);
  });

  it("shows a server-rejected state when validation fails upstream", async () => {
    mocks.initiateCheckout.mockResolvedValue({
      ok: false,
      errors: ["Only 5 of Sitara Cut-Dana are available. Please adjust your quantity."],
    });

    const user = userEvent.setup();
    render(<CheckoutForm {...props} />);

    await fillValidCheckout(user);
    await user.click(screen.getByRole("button", { name: "Place Order" }));

    expect(
      await screen.findByText(/only 5 of sitara cut-dana are available/i),
    ).toBeInTheDocument();
  });
});