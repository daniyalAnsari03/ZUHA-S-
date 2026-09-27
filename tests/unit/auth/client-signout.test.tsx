import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

type SignOutModule = typeof import("@/lib/auth/client-signout");

async function loadModule(): Promise<SignOutModule> {
  return import("@/lib/auth/client-signout");
}

describe("signOutClient", () => {
  beforeEach(() => {
    vi.useRealTimers();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { href: "" },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("terminates the session before redirecting away from the page", async () => {
    let resolveSignOut: () => void = () => {};
    fetchMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSignOut = resolve;
        }),
    );

    const { signOutClient } = await loadModule();
    const pending = signOutClient();

    // Still on the page: navigation would cancel the sign-out round-trip and
    // leave the server session alive.
    expect(window.location.href).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/session",
      expect.objectContaining({ method: "POST" }),
    );

    resolveSignOut();
    await pending;

    expect(window.location.href).toBe("/");
  });

  it("still redirects when sign-out rejects", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const { signOutClient } = await loadModule();
    await signOutClient();

    expect(window.location.href).toBe("/");
  });

  it("does not hang forever when the auth server never answers", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(() => new Promise<void>(() => {}));

    const { signOutClient } = await loadModule();
    const pending = signOutClient();

    await vi.advanceTimersByTimeAsync(2500);
    await pending;

    expect(window.location.href).toBe("/");
  });
});
