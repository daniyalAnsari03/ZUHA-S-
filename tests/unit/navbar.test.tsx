import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Navbar } from "@/components/storefront/navbar";
import {
  getActiveCategories,
  getAllActiveProducts,
} from "@/lib/storefront/data";

describe("Navbar", () => {
  it("opens the shop menu drawer and closes it with Escape", async () => {
    const user = userEvent.setup();
    render(
      <Navbar
        categories={getActiveCategories()}
        products={getAllActiveProducts()}
      />,
    );

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

  it("opens the cart panel placeholder", async () => {
    const user = userEvent.setup();
    render(
      <Navbar
        categories={getActiveCategories()}
        products={getAllActiveProducts()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cart" }));

    const dialog = await screen.findByRole("dialog", { name: "Your Bag" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/in a later phase/i)).toBeInTheDocument();
  });
});