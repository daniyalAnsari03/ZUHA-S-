import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Newsletter } from "@/components/storefront/newsletter";
import { validate } from "@/lib/validation/validate";
import { z } from "zod";

describe("Newsletter", () => {
  it("shows a validation error for an invalid email", async () => {
    const user = userEvent.setup();
    render(<Newsletter />);

    await user.type(screen.getByLabelText("Email address"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Subscribe" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /valid email/i,
    );
  });

  it("never claims a subscription was saved", async () => {
    const user = userEvent.setup();
    render(<Newsletter />);

    await user.type(screen.getByLabelText("Email address"), "a@b.com");
    await user.click(screen.getByRole("button", { name: "Subscribe" }));

    const notice = await screen.findByText(/later phase/i);
    expect(notice).toHaveTextContent(/nothing was saved yet/i);
    expect(notice.textContent).not.toMatch(/subscribed|saved successfully/i);
  });

  it("validates the email through the shared Zod schema", () => {
    expect(validate(z.string().email(), "good@example.com").success).toBe(
      true,
    );
    expect(validate(z.string().email(), "nope").success).toBe(false);
  });
});