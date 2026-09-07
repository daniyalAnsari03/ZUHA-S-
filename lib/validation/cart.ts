import { z } from "zod";

/**
 * Zod schemas for the cart, wishlist and checkout domains (Phase 4).
 * All business fields are validated structurally before any service work runs.
 */

/** A cart item add request: must reference an existing product and a valid quantity. */
export const addToCartSchema = z.object({
  productId: z.string().uuid("A valid product is required."),
  quantity: z
    .number()
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(1000, "Quantity is unreasonably large."),
});

export type AddToCartInput = z.input<typeof addToCartSchema>;

/** Update a cart item's quantity. */
export const updateCartItemSchema = z.object({
  itemId: z.string().uuid("A valid cart item is required."),
  quantity: z
    .number()
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(1000, "Quantity is unreasonably large."),
});

export type UpdateCartItemInput = z.input<typeof updateCartItemSchema>;

/** Remove a cart item. */
export const removeCartItemSchema = z.object({
  itemId: z.string().uuid("A valid cart item is required."),
});

export type RemoveCartItemInput = z.input<typeof removeCartItemSchema>;

/** Toggle a product in/out of the wishlist. */
export const toggleWishlistSchema = z.object({
  productId: z.string().uuid("A valid product is required."),
});

export type ToggleWishlistInput = z.input<typeof toggleWishlistSchema>;

/** Add a product to the wishlist. */
export const addToWishlistSchema = z.object({
  productId: z.string().uuid("A valid product is required."),
});

export type AddToWishlistInput = z.input<typeof addToWishlistSchema>;

/** Remove a product from the wishlist by its wishlist item id. */
export const removeWishlistItemSchema = z.object({
  itemId: z.string().uuid("A valid wishlist item is required."),
});

export type RemoveWishlistItemInput = z.input<typeof removeWishlistItemSchema>;

/** Clean, validated phone number used for Pakistan-focused checkout. */
export const pakistanPhoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required.")
  .regex(
    /^(\+?92|0)?3\d{9}$/,
    "Enter a valid Pakistani mobile number (e.g. 0300 1234567).",
  );

/** Clean, validated email address. */
export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Enter a valid email address.");

/**
 * Customer/shipping details collected at checkout. Server-side validation is
 * mandatory; the browser must never be trusted for these values.
 */
export const checkoutCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Full name is required.")
    .max(120, "Name must be 120 characters or fewer."),
  phone: pakistanPhoneSchema,
  email: emailSchema,
  shippingAddress: z
    .string()
    .trim()
    .min(1, "Shipping address is required.")
    .max(300, "Shipping address must be 300 characters or fewer."),
  city: z
    .string()
    .trim()
    .min(1, "City is required.")
    .max(80, "City must be 80 characters or fewer."),
  postalCode: z
    .string()
    .trim()
    .max(20, "Postal/area code must be 20 characters or fewer.")
    .optional(),
  orderNotes: z
    .string()
    .trim()
    .max(1000, "Order notes must be 1000 characters or fewer.")
    .optional(),
});

export type CheckoutCustomerInput = z.input<typeof checkoutCustomerSchema>;
