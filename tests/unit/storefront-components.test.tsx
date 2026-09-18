import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StorefrontState } from "@/components/storefront/storefront-provider";

import { SearchPanel } from "@/components/storefront/search-panel";
import { AddToBagButton } from "@/components/storefront/add-to-bag-button";
import {
  getActiveCategories,
  getAllActiveProducts,
} from "@/lib/storefront/data";

const mocks = vi.hoisted(() => ({
  addToCart: vi.fn<() => Promise<string | null>>(async () => null),
}));

vi.mock("@/components/storefront/storefront-provider", () => ({
  StorefrontProvider: ({ children }: { children: React.ReactNode }) => children,
  useStorefront: () =>
    ({
      cartCount: 0,
      wishlistCount: 0,
      subtotal: 0,
      ready: true,
      addToCart: mocks.addToCart,
      updateCartItem: async () => null,
      removeCartItem: async () => null,
      clearCart: async () => null,
      toggleWishlist: async () => ({ saved: false, error: null }),
      refreshWishlist: async () => {},
    }) satisfies StorefrontState,
}));

describe("SearchPanel", () => {
  it("filters the mock catalog by name", async () => {
    const user = userEvent.setup();
    const [products, categories] = await Promise.all([
      getAllActiveProducts(),
      getActiveCategories(),
    ]);
    render(
      <SearchPanel
        products={products}
        categories={categories}
        onNavigate={() => {}}
      />,
    );

    await user.type(
      screen.getByLabelText("Search products"),
      "Khirke Jamawar",
    );

    expect(
      screen.getByRole("link", { name: /Khirke Jamawar/i }),
    ).toBeInTheDocument();
  });

  it("shows an honest empty state when nothing matches", async () => {
    const user = userEvent.setup();
    const [products, categories] = await Promise.all([
      getAllActiveProducts(),
      getActiveCategories(),
    ]);
    render(
      <SearchPanel
        products={products}
        categories={categories}
        onNavigate={() => {}}
      />,
    );

    await user.type(
      screen.getByLabelText("Search products"),
      "zzz-no-match",
    );

    expect(screen.getByText(/no products match/i)).toBeInTheDocument();
  });
});

describe("AddToBagButton", () => {
  beforeEach(() => {
    mocks.addToCart.mockReset();
    mocks.addToCart.mockResolvedValue(null);
  });

  it("shows a functional Add to Cart control", () => {
    render(<AddToBagButton productId="00000000-0000-4000-8000-000000000000" />);
    expect(
      screen.getByRole("button", { name: "ADD TO CART" }),
    ).toBeInTheDocument();
  });

  it("adds the product to the bag on click", async () => {
    const user = userEvent.setup();
    render(<AddToBagButton productId="00000000-0000-4000-8000-000000000000" />);

    await user.click(screen.getByRole("button", { name: "ADD TO CART" }));

    expect(mocks.addToCart).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000000",
      1,
    );
    expect(await screen.findByText("Added to your bag")).toBeInTheDocument();
  });

  it("surfaces a sign-in prompt when adding as a guest", async () => {
    mocks.addToCart.mockResolvedValue("Please sign in to add items to your bag.");
    const user = userEvent.setup();
    render(<AddToBagButton productId="00000000-0000-4000-8000-000000000000" />);

    await user.click(screen.getByRole("button", { name: "ADD TO CART" }));

    expect(await screen.findByText(/please sign in/i)).toBeInTheDocument();
  });
});