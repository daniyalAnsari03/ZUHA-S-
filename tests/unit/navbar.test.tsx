import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Navbar } from "@/components/storefront/navbar";
import { getActiveCategories, getAllActiveProducts } from "@/lib/storefront/data";

const viMocks = vi.hoisted(() => ({
  addToCart: vi.fn(),
  getCartDetailsAction: vi.fn().mockResolvedValue({
    ok: true,
    payload: { items: [], subtotal: 0, total: 0, itemCount: 0, currency: "PKR" },
  }),
}));

vi.mock("@/app/storefront/actions", () => ({
  getCartDetailsAction: (...args: unknown[]) => viMocks.getCartDetailsAction(...args),
  getWishlistDetailsAction: vi.fn().mockResolvedValue({
    ok: true,
    payload: { items: [], itemCount: 0 },
  }),
}));

vi.mock("@/components/storefront/storefront-provider", () => ({
  useStorefront: () => ({
    cartCount: 0,
    wishlistCount: 0,
    subtotal: 0,
    ready: true,
    addToCart: viMocks.addToCart,
  }),
}));

describe("Navbar", () => {
  it("opens the shop menu drawer and closes it with Escape", async () => {
    const user = userEvent.setup();
    const [categories, products] = await Promise.all([
      getActiveCategories(),
      getAllActiveProducts(),
    ]);
    render(<Navbar categories={categories} products={products} />);

    await user.click(screen.getByRole("button", { name: "Open menu" }));

    const dialog = await screen.findByRole("dialog", { name: "Shop" });
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Jamawar/ }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Shop" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("opens the cart panel", async () => {
    const user = userEvent.setup();
    const [categories, products] = await Promise.all([
      getActiveCategories(),
      getAllActiveProducts(),
    ]);
    render(<Navbar categories={categories} products={products} />);

    await user.click(screen.getByRole("button", { name: /Cart/ }));

    const dialog = await screen.findByRole("dialog", { name: "Your Bag" });
    expect(dialog).toBeInTheDocument();
  });
});