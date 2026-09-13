import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your dINS by Daniyal account.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Premium customer login page for dINS by Daniyal.
 *
 * Sits directly on the storefront's ivory/cream background (the same token the
 * Footer uses) with no chrome — no announcement bar, navbar or footer. On
 * desktop the brand mark sits beside the authentication area; on mobile the
 * layout stacks with the logo above. OAuth callback errors arrive on the query
 * string and are passed into the form so they render during server rendering.
 */
type LoginPageProps = {
  searchParams: Promise<{ error?: string | string[]; message?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, message } = await searchParams;
  const rawError = Array.isArray(error) ? error[0] : error;
  const rawMessage = Array.isArray(message) ? message[0] : message;

  return (
    <main className="flex flex-1 bg-ivory">
      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-14 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20 lg:py-24">
        <div className="flex items-center justify-center lg:justify-start">
          <Link
            href="/"
            aria-label="dINS by Daniyal — home"
            className="inline-block"
          >
            <Image
              src="/images/brand/dins-by-daniyal-logo.png"
              alt="dINS by Daniyal"
              width={408}
              height={214}
              priority
              className="h-16 w-auto sm:h-20 lg:h-32"
            />
          </Link>
        </div>

        <div className="w-full max-w-md justify-self-center lg:justify-self-start">
          <LoginForm initialError={rawError ?? null} initialMessage={rawMessage ?? null} />

          <p className="mt-6 text-sm text-charcoal-muted">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-plum underline-offset-4 hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}