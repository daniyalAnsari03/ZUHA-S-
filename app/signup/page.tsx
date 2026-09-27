import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a DINS by Daniyal account.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Premium customer signup page for DINS by Daniyal.
 *
 * Visually identical to the `/login` authentication screen: sits directly on
 * the storefront's ivory background with no chrome (no announcement bar,
 * navbar or footer). On desktop the brand mark sits beside the authentication
 * area; on mobile the layout stacks with the logo above. OAuth callback errors
 * arrive on the query string and are passed into the form so they render
 * during server rendering.
 */
type SignupPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { error } = await searchParams;
  const rawError = Array.isArray(error) ? error[0] : error;

  return (
    <main className="flex flex-1 bg-ivory">
      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-14 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20 lg:py-24">
        <div className="flex items-center justify-center lg:justify-start">
          <Link
            href="/"
            aria-label="DINS by Daniyal — home"
            className="inline-block"
          >
            <Image
              src="/images/brand/dins-by-daniyal-logo.png"
              alt="DINS by Daniyal"
              width={408}
              height={214}
              priority
              className="h-16 w-auto sm:h-20 lg:h-32"
            />
          </Link>
        </div>

        <div className="w-full max-w-md justify-self-center lg:justify-self-start">
          <SignupForm initialError={rawError ?? null} />

          <p className="mt-6 text-sm text-charcoal-muted">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-plum underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
