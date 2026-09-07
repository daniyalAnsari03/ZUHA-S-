"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { validate } from "@/lib/validation/validate";

const newsletterSchema = z.object({
  email: z
    .string()
    .min(1, "Please enter your email address.")
    .email("Please enter a valid email address."),
});

type NewsletterFormValues = z.infer<typeof newsletterSchema>;

/**
 * Newsletter entry point. Validation is live but subscription persistence is
 * not — this UI never claims that a subscription was saved.
 */
export function Newsletter() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<NewsletterFormValues>();

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onSubmit = handleSubmit((values) => {
    const result = validate(newsletterSchema, values);

    if (!result.success) {
      setError(result.error);
      setNotice(null);
      return;
    }

    setError(null);
    setNotice(
      "Thanks — newsletter sign-up goes live in a later phase. Nothing was saved yet.",
    );
    reset();
  });

  return (
    <section
      id="newsletter"
      aria-labelledby="newsletter-heading"
      className="bg-plum-dark"
    >
      <Container size="md" className="py-16 text-center sm:py-20">
        <p className="text-[11px] uppercase tracking-[0.32em] text-gold-soft">
          Join the list
        </p>
        <h2
          id="newsletter-heading"
          className="mt-3 font-serif text-2xl text-white sm:text-3xl"
        >
          Early access to new collections
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/70">
          Be the first to know about fresh drops, limited pieces and private
          previews.
        </p>

        <form
          onSubmit={onSubmit}
          noValidate
          className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
        >
          <label htmlFor="newsletter-email" className="sr-only">
            Email address
          </label>
          <input
            id="newsletter-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Your email address"
            aria-invalid={error ? true : undefined}
            {...register("email")}
            className="h-12 w-full rounded-full border border-white/20 bg-white/10 px-5 text-sm text-white placeholder:text-white/50 focus:border-gold-soft focus:outline-none focus:ring-2 focus:ring-gold-muted/30"
          />
          <Button
            type="submit"
            variant="gold"
            size="md"
            disabled={isSubmitting}
            className="shrink-0 rounded-full"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Subscribe
          </Button>
        </form>

        <div aria-live="polite" className="mx-auto mt-4 min-h-5 max-w-md">
          {error ? (
            <p role="alert" className="text-sm text-gold-soft">
              {error}
            </p>
          ) : notice ? (
            <p className="text-sm text-white/70">{notice}</p>
          ) : null}
        </div>
      </Container>
    </section>
  );
}