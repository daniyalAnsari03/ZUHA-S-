import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders children with an accessible button role", () => {
    render(<Button>Add to Bag</Button>);
    expect(
      screen.getByRole("button", { name: "Add to Bag" }),
    ).toBeInTheDocument();
  });

  it("is disabled when the disabled prop is set", () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
