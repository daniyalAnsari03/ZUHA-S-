"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const signupSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "Email is required.")
      .toLowerCase()
      .email("Enter a valid email address."),
    password: z.string().min(6, "Password must be at least 6 characters."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

type SignupFormValues = z.infer<typeof signupSchema>;

type SignupFormProps = {
  /** OAuth/session error passed from the server page's search params. */
  initialError?: string | null;
};

type FormState = "idle" | "submitting";

function friendlySignupError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("already registered") ||
    lower.includes("already been registered")
  ) {
    return "An account with this email already exists. Please sign in instead.";
  }
  if (lower.includes("password")) {
    return "Your password is not strong enough. Please choose at least 6 characters.";
  }
  if (
    lower.includes("rate limit") ||
    lower.includes("too many") ||
    lower.includes("for security purposes")
  ) {
    return "Too many signup attempts. Please wait a moment and try again.";
  }
  if (lower.includes("signup") && lower.includes("disabled")) {
    return "Signup is temporarily unavailable. Please try again later.";
  }
  return message;
}

/**
 * Client-side signup form. Uses the existing Supabase browser client
 * (`lib/supabase/client.ts`) for Google OAuth and email/password sign-up,
 * matching the `/login` screen's visual language and authentication flow.
 */
export function SignupForm({ initialError = null }: SignupFormProps) {
  const router = useRouter();
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);
  const busyRef = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  });

  async function handleGoogle() {
    if (busyRef.current) return;
    busyRef.current = true;
    setState("submitting");
    setError(null);
    setNotice(null);

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/`,
        },
      });

      if (error) {
        throw error;
      }
      // The redirect flow navigates to Google from here; keep `submitting`
      // until the browser leaves the page.
    } catch {
      setError("We could not start Google sign up. Please try again.");
      busyRef.current = false;
      setState("idle");
    }
  }

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    // Run the zod validation + signup handler when the form is submitted;
    // `handleSubmit` also prevents the default browser submission.
    void handleSubmit(handleEmailPassword)(event);
  };

  async function handleEmailPassword(values: SignupFormValues) {
    // `handleSubmit` already blocks re-entry while validation runs; guard for
    // safety in case the browser triggers the handler again.
    if (busyRef.current) return;
    busyRef.current = true;
    setState("submitting");
    setError(null);
    setNotice(null);

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const { data, error } = await createClient().auth.signUp({
        email: values.email,
        password: values.password,
      });

      if (error) {
        setError(friendlySignupError(error.message));
        return;
      }

      router.replace(
        "/login?message=" +
          encodeURIComponent("Account created successfully. Please sign in."),
      );
      return;
    } catch {
      setError("We could not create your account. Please try again.");
    } finally {
      busyRef.current = false;
      setState("idle");
    }
  }

  return (
    <div className="w-full">
      <h1 className="font-serif text-2xl text-charcoal sm:text-3xl">
        Create account
      </h1>
      <p className="mt-2 text-sm text-charcoal-muted">
        Join DINS by Daniyal for a personalised shopping experience.
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

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
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
            placeholder="you@example.com"
            invalid={!!errors.email}
            disabled={state !== "idle"}
            {...register("email")}
          />
          {errors.email ? (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {errors.email.message}
            </p>
          ) : null}
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
            autoComplete="new-password"
            required
            placeholder="••••••••"
            invalid={!!errors.password}
            disabled={state !== "idle"}
            {...register("password")}
          />
          {errors.password ? (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="mb-1.5 block text-sm font-medium text-charcoal"
          >
            Confirm Password
          </label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            placeholder="••••••••"
            invalid={!!errors.confirmPassword}
            disabled={state !== "idle"}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword ? (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {errors.confirmPassword.message}
            </p>
          ) : null}
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}

        {notice ? (
          <p
            role="status"
            className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            {notice}
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
              Creating account…
            </>
          ) : (
            "Create Account"
          )}
        </Button>
      </form>
    </div>
  );
}
