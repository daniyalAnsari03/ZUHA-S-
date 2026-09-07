import { z } from "zod";

/**
 * Zod schemas for the catalog domain (categories + products).
 * Used by server actions and service-layer mutations. All business fields are
 * validated structurally before any service work runs.
 */

export const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required.")
  .max(120, "Slug must be 120 characters or fewer.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must be lowercase letters, numbers and single hyphens.",
  );

const optionalText = z
  .union([z.string().trim().max(2000), z.literal("")])
  .optional()
  .transform((v) => (v ? v : null));

const optionalShortText = z
  .union([z.string().trim().max(120), z.literal("")])
  .optional()
  .transform((v) => (v ? v : null));

export const categoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Category name is required.")
    .max(80, "Category name must be 80 characters or fewer."),
  slug: slugSchema,
  description: optionalShortText,
  imageUrl: optionalShortText,
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export type CategoryInput = z.input<typeof categoryInputSchema>;

export const productInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Product name is required.")
    .max(160, "Product name must be 160 characters or fewer."),
  slug: slugSchema,
  description: optionalText,
  fabric: optionalShortText,
  embroidery: optionalShortText,
  color: optionalShortText,
  label: optionalShortText,
  categoryId: z
    .union([z.string().uuid(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  price: z
    .number()
    .min(0, "Price cannot be negative.")
    .max(1_000_000_000, "Price is unreasonably large."),
  compareAtPrice: z
    .union([z.number().min(0).max(1_000_000_000), z.literal(null)])
    .optional()
    .transform((v) => v ?? null),
  sku: optionalShortText,
  stockQuantity: z
    .number()
    .int()
    .min(0, "Stock cannot be negative.")
    .max(1_000_000),
  lowStockThreshold: z
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .default(5),
  imageUrl: optionalShortText,
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
});

export type ProductInput = z.input<typeof productInputSchema>;

export const stockUpdateSchema = z.object({
  stockQuantity: z
    .number()
    .int()
    .min(0, "Stock cannot be negative.")
    .max(1_000_000),
  lowStockThreshold: z
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .default(5),
});

export type StockUpdateInput = z.input<typeof stockUpdateSchema>;