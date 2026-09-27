import { z } from "zod";

/**
 * Newsletter sign-up validation.
 *
 * The storefront Newsletter is a client component, so it must not import this
 * module eagerly — `zod` is a large dependency and the newsletter sits on
 * every storefront page. Importing it lazily inside the submit handler keeps it
 * in an on-demand chunk while leaving this schema as the single source of truth
 * for what counts as a valid address.
 */
export const newsletterSchema = z.object({
  email: z
    .string()
    .min(1, "Please enter your email address.")
    .email("Please enter a valid email address."),
});

export type NewsletterFormValues = z.infer<typeof newsletterSchema>;

/**
 * Validate a submitted email, returning either a clean value or the first
 * human-readable message. Never throws.
 */
export function validateNewsletterEmail(
  email: unknown,
): { ok: true; email: string } | { ok: false; error: string } {
  const parsed = newsletterSchema.safeParse({ email });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email address." };
  }
  return { ok: true, email: parsed.data.email };
}
