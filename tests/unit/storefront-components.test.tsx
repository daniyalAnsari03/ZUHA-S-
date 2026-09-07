import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SearchPanel } from "@/components/storefront/search-panel";
import { AddToBagButton } from "@/components/storefront/add-to-bag-button";
import {
  getActiveCategories,
  getAllActiveProducts,
} from "@/lib/storefront/data";

describe("SearchPanel", () => {
  it("filters the mock catalog by name", async () => {
    const user = userEvent.setup();
    render(
      <SearchPanel
        products={getAllActiveProducts()}
        categories={getActiveCategories()}
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
    render(
      <SearchPanel
        products={getAllActiveProducts()}
        categories={getActiveCategories()}
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
  it("shows an honest placeholder and never claims persistence", async () => {
    const user = userEvent.setup();
    render(<AddToBagButton productName="Sitara Cut-Dana" />);

    expect(
      screen.getByRole("button", { name: "Add Sitara Cut-Dana to Bag" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Add Sitara Cut-Dana to Bag" }),
    );

    expect(
      screen.getByRole("button", { name: /Cart arriving soon/i }),
    ).toBeInTheDocument();
  });
});