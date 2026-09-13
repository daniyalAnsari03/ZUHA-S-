import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignupForm } from "@/app/signup/signup-form";

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithOAuth: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signUp: mocks.signUp,
      signInWithOAuth: mocks.signInWithOAuth,
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
}));

async function fillValidSignup(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^email/i), "ali@example.com");
  await user.type(screen.getByLabelText(/^password/i), "secret123");
  await user.type(screen.getByLabelText(/confirm password/i), "secret123");
}

describe("SignupForm", () => {
  beforeEach(() => {
    mocks.signUp.mockReset();
    mocks.signInWithOAuth.mockReset();
    mocks.replace.mockReset();
    mocks.refresh.mockReset();
  });

  it("renders the signup screen with Google and email options", () => {
    render(<SignupForm />);

    expect(screen.getByRole("heading", { name: /create account/i }));
    expect(screen.getByRole("button", { name: /continue with google/i }));
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i }));
  });

  it("rejects mismatched passwords without calling signUp", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/^email/i), "ali@example.com");
    await user.type(screen.getByLabelText(/^password/i), "secret123");
    await user.type(screen.getByLabelText(/confirm password/i), "secret124");

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("rejects an invalid email without calling signUp", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/^email/i), "not-an-email");
    await user.type(screen.getByLabelText(/^password/i), "secret123");
    await user.type(screen.getByLabelText(/confirm password/i), "secret123");

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("redirects to login after successful signup when no session is returned", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: "user-1" }, session: null },
      error: null,
    });

    const user = userEvent.setup();
    render(<SignupForm />);

    await fillValidSignup(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "ali@example.com",
      password: "secret123",
    });
    expect(mocks.replace).toHaveBeenCalledWith(
      "/login?message=Account%20created%20successfully.%20Please%20sign%20in.",
    );
  });

  it("redirects to login after a successful signup with an active session", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: "user-1" }, session: { access_token: "token" } },
      error: null,
    });

    const user = userEvent.setup();
    render(<SignupForm />);

    await fillValidSignup(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(mocks.signUp).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenCalledWith(
      "/login?message=Account%20created%20successfully.%20Please%20sign%20in.",
    );
  });

  it("shows a friendly error when the email is already registered", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "User already registered" },
    });

    const user = userEvent.setup();
    render(<SignupForm />);

    await fillValidSignup(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/an account with this email already exists/i),
    ).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("surfaces a passed-in OAuth error", () => {
    render(<SignupForm initialError="Access denied from Google." />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Access denied from Google.",
    );
  });

  it("accepts a valid Gmail address (hira@gmail.com)", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: "user-2" }, session: null },
      error: null,
    });

    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/^email/i), "hira@gmail.com");
    await user.type(screen.getByLabelText(/^password/i), "secret123");
    await user.type(screen.getByLabelText(/confirm password/i), "secret123");

    await user.click(screen.getByRole("button", { name: /create account/i }));

    // Should NOT show a validation error
    expect(screen.queryByText(/enter a valid email address/i)).not.toBeInTheDocument();
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "hira@gmail.com",
      password: "secret123",
    });
  });

  it("accepts a valid Gmail with uppercase (Hira@Gmail.COM)", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: "user-3" }, session: null },
      error: null,
    });

    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/^email/i), "Hira@Gmail.COM");
    await user.type(screen.getByLabelText(/^password/i), "secret123");
    await user.type(screen.getByLabelText(/confirm password/i), "secret123");

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(screen.queryByText(/enter a valid email address/i)).not.toBeInTheDocument();
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "hira@gmail.com",
      password: "secret123",
    });
  });

  it("safely handles accidental surrounding whitespace in email", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: "user-4" }, session: null },
      error: null,
    });

    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/^email/i), "  hira@gmail.com  ");
    await user.type(screen.getByLabelText(/^password/i), "secret123");
    await user.type(screen.getByLabelText(/confirm password/i), "secret123");

    await user.click(screen.getByRole("button", { name: /create account/i }));

    // Zod .trim() + .toLowerCase() should normalise the email
    expect(screen.queryByText(/enter a valid email address/i)).not.toBeInTheDocument();
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "hira@gmail.com",
      password: "secret123",
    });
  });

  it("rejects clearly malformed email", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/^email/i), "not-an-email");
    await user.type(screen.getByLabelText(/^password/i), "secret123");
    await user.type(screen.getByLabelText(/confirm password/i), "secret123");

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("shows a friendly error when Supabase reports rate limiting", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "For security purposes, you can only request this after 30 seconds." },
    });

    const user = userEvent.setup();
    render(<SignupForm />);

    await fillValidSignup(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/too many signup attempts/i),
    ).toBeInTheDocument();
  });
});