"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LoginState = "idle" | "submitting";

type LoginFormProps = {
  /** OAuth/session error passed from the server page's search params. */
  initialError?: string | null;
  /** Success message passed from the server page's search params. */
  initialMessage?: string | null;
  /**
   * Local path to return to once signed in, already validated as a same-origin
   * relative path by the server page. Defaults to the storefront home.
   */
  nextPath?: string;
};

function friendlyLoginError(error: {
  message?: string;
  code?: string;
}): string {
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("invalid login credentials")) {
    return "Invalid email or password. Please check your details and try again.";
  }

  if (message.includes("email not confirmed")) {
    return "Please confirm your email address before signing in. Check your inbox for the confirmation link.";
  }

  if (message.includes("user not found") || message.includes("no user found")) {
    return "No account found with this email. Please sign up first.";
  }

  if (
    message.includes("too many") ||
    message.includes("rate limit") ||
    message.includes("for security purposes")
  ) {
    return "Too many login attempts. Please wait a moment and try again.";
  }

  if (message.includes("signup") && message.includes("disabled")) {
    return "Login is temporarily unavailable. Please try again later.";
  }

  return "Invalid email or password. Please check your details and try again.";
}

/**
 * Client-side login form. Uses the existing Supabase browser client
 * (`lib/supabase/client.ts`) for Google OAuth and email/password sign-in.
 */
export function LoginForm({
  initialError = null,
  initialMessage = null,
  nextPath = "/",
}: LoginFormProps) {
  const router = useRouter();
  const [state, setState] = useState<LoginState>("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    initialMessage,
  );
  const busyRef = useRef(false);

  async function handleGoogle() {
    if (busyRef.current) return;
    busyRef.current = true;
    setState("submitting");
    setError(null);
    setSuccessMessage(null);

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            nextPath,
          )}`,
        },
      });

      if (error) {
        throw error;
      }
      // The redirect flow navigates to Google from here; keep `submitting`
      // until the browser leaves the page.
    } catch {
      setError("We could not start Google sign in. Please try again.");
      busyRef.current = false;
      setState("idle");
    }
  }

  async function handleEmailPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setState("submitting");
    setError(null);
    setSuccessMessage(null);

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const { error } = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      router.replace(nextPath);
      router.refresh();
    } catch (err) {
      const loginError = err as { message?: string; code?: string };
      setError(friendlyLoginError(loginError));
      busyRef.current = false;
      setState("idle");
    }
  }

  return (
    <div className="w-full">
      <h1 className="font-serif text-2xl text-charcoal sm:text-3xl">Sign in</h1>
      <p className="mt-2 text-sm text-charcoal-muted">
        Welcome back to DINS by Daniyal.
      </p>

      <div className="mt-8">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={handleGoogle}
          disabled={state !== "idle"}
        >
          {state === "submitting" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z"
              />
            </svg>
          )}
          Continue with Google
        </Button>
      </div>

      <div className="my-6 flex items-center gap-4" aria-hidden="true">
        <span className="h-px flex-1 bg-charcoal/10" />
        <span className="text-xs uppercase tracking-wider text-charcoal-muted">
          or
        </span>
        <span className="h-px flex-1 bg-charcoal/10" />
      </div>

      <form
        onSubmit={handleEmailPassword}
        className="flex flex-col gap-4"
        noValidate
      >
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-charcoal"
          >
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setSuccessMessage(null);
            }}
            placeholder="you@example.com"
            disabled={state !== "idle"}
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium text-charcoal"
          >
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setSuccessMessage(null);
            }}
            placeholder="••••••••"
            disabled={state !== "idle"}
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}

        {successMessage ? (
          <p
            role="status"
            className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            {successMessage}
          </p>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="mt-2 w-full"
          disabled={state !== "idle"}
        >
          {state === "submitting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
    </div>
  );
}
