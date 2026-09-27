import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  CartDetailsPayload,
  WishlistDetailsPayload,
} from "@/app/storefront/actions";
import { CartPanel } from "@/components/storefront/cart-panel";
import { WishlistPanel } from "@/components/storefront/wishlist-panel";
import type { StorefrontState } from "@/components/storefront/storefront-provider";

const mocks = vi.hoisted(() => ({
  getCartDetails: vi.fn(),
  getWishlistDetails: vi.fn(),
}));

vi.mock("@/app/storefront/actions", () => ({
  getCartDetailsAction: mocks.getCartDetails,
  getWishlistDetailsAction: mocks.getWishlistDetails,
  removeWishlistItemAction: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/components/storefront/storefront-provider", () => ({
  StorefrontProvider: ({ children }: { children: React.ReactNode }) => children,
  useStorefront: () =>
    ({
      cartCount: 0,
      wishlistCount: 0,
      subtotal: 0,
      ready: true,
      signedIn: true,
      addToCart: async () => null,
      updateCartItem: async () => null,
      removeCartItem: async () => null,
      clearCart: async () => null,
      toggleWishlist: async () => ({ saved: false, error: null }),
      refreshWishlist: async () => {},
    }) satisfies StorefrontState,
}));

const emptyCart: CartDetailsPayload = {
  cartId: "cart-empty",
  itemCount: 0,
  subtotal: 0,
  items: [],
};

const emptyWishlist: WishlistDetailsPayload = {
  wishlistId: "wish-empty",
  itemCount: 0,
  productIds: [],
  items: [],
};

describe("CartPanel", () => {
  it("shows a clear empty-bag state", async () => {
    mocks.getCartDetails.mockResolvedValue({ ok: true, payload: emptyCart });

    render(<CartPanel />);

    expect(await screen.findByText("Your bag is empty")).toBeInTheDocument();
  });

  it("renders items with price and quantity from trusted data", async () => {
    mocks.getCartDetails.mockResolvedValue({
      ok: true,
      payload: {
        cartId: "cart-1",
        itemCount: 2,
        subtotal: 69000,
        items: [
          {
            id: "item-1",
            productId: "00000000-0000-4000-8000-000000000001",
            quantity: 2,
            name: "Khirke Jamawar",
            slug: "khirke-jamawar",
            price: 34500,
            image: "/images/placeholders/product-1.svg",
            fabric: "Hand-woven jamawar",
            stock: 12,
            subtotal: 69000,
          },
        ],
      },
    });

    render(<CartPanel />);

    expect(await screen.findByText("Khirke Jamawar")).toBeInTheDocument();
    expect(screen.getByText("PKR 34,500")).toBeInTheDocument();
    expect(screen.getByText(/Subtotal \(2 items\)/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /checkout/i })).toBeInTheDocument();
  });

  it("offers sign-in instead of an error when the visitor is signed out", async () => {
    mocks.getCartDetails.mockResolvedValue({
      ok: false,
      error: "Please sign in to view your bag.",
    });

    render(<CartPanel />);

    expect(await screen.findByText("Your bag is waiting")).toBeInTheDocument();
    expect(
      screen.queryByText("Unable to load your bag"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /sign in/i }),
    ).toHaveAttribute("href", "/login?next=/cart");
  });
});

describe("WishlistPanel", () => {
  it("shows a clear empty-wishlist state", async () => {
    mocks.getWishlistDetails.mockResolvedValue({
      ok: true,
      payload: emptyWishlist,
    });

    render(<WishlistPanel />);

    expect(
      await screen.findByText("Your wishlist is empty"),
    ).toBeInTheDocument();
  });

  it("renders saved items with a move-to-bag action", async () => {
    mocks.getWishlistDetails.mockResolvedValue({
      ok: true,
      payload: {
        wishlistId: "wish-1",
        itemCount: 1,
        productIds: ["00000000-0000-4000-8000-000000000002"],
        items: [
          {
            id: "wish-item-1",
            productId: "00000000-0000-4000-8000-000000000002",
            name: "Sitara Cut-Dana",
            slug: "sitara-cut-dana",
            price: 21800,
            image: "/images/placeholders/product-2.svg",
            fabric: "Cotton silk",
            stock: 8,
          },
        ],
      },
    });

    render(<WishlistPanel />);

    expect(await screen.findByText("Sitara Cut-Dana")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /move to bag/i }),
    ).toBeInTheDocument();
  });

  it("offers sign-in instead of an error when the visitor is signed out", async () => {
    mocks.getWishlistDetails.mockResolvedValue({
      ok: false,
      error: "Please sign in to view your wishlist.",
    });

    render(<WishlistPanel />);

    expect(
      await screen.findByText("Your wishlist is waiting"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Unable to load your wishlist"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /sign in/i }),
    ).toHaveAttribute("href", "/login?next=/wishlist");
  });
});
