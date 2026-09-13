import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductPrice } from "@/components/storefront/product-price";
import type { Product } from "@/lib/storefront/types";

function makeProduct(
  price: number,
  compareAtPrice: number | undefined,
): Product {
  return {
    id: "prod-1",
    slug: "test-product",
    name: "Test Product",
    description: "",
    price,
    compareAtPrice,
    image: "/images/placeholders/product-1.svg",
    categorySlug: "plain",
    stockQuantity: 5,
    lowStockThreshold: 5,
    active: true,
  };
}

describe("ProductPrice", () => {
  it("shows the current price as the primary value", () => {
    render(<ProductPrice product={makeProduct(34500, undefined)} />);
    expect(screen.getByText("PKR 34,500")).toBeInTheDocument();
  });

  it("shows the struck original price and a dynamic discount when compare-at is higher", () => {
    render(<ProductPrice product={makeProduct(34500, 40000)} />);
    expect(screen.getByText("PKR 34,500")).toBeInTheDocument();
    expect(screen.getByText("PKR 40,000")).toBeInTheDocument();
    expect(screen.getByText("14% off")).toBeInTheDocument();
  });

  it("never renders discount UI without a higher compare-at price", () => {
    const { rerender } = render(
      <ProductPrice product={makeProduct(34500, 34500)} />,
    );
    expect(screen.getByText("PKR 34,500")).toBeInTheDocument();
    expect(screen.queryByText(/off/)).not.toBeInTheDocument();

    rerender(<ProductPrice product={makeProduct(34500, 30000)} />);
    expect(screen.queryByText(/off/)).not.toBeInTheDocument();
    expect(screen.queryByText("PKR 30,000")).not.toBeInTheDocument();
  });
});