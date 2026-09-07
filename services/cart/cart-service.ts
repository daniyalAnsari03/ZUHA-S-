import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import {
  addToCartSchema,
  removeCartItemSchema,
  updateCartItemSchema,
  type AddToCartInput,
  type RemoveCartItemInput,
  type UpdateCartItemInput,
} from "@/lib/validation/cart";
import { ServiceError } from "@/services/base";

type CartRow = Database["public"]["Tables"]["carts"]["Row"];
type CartItemRow = Database["public"]["Tables"]["cart_items"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];

/** A cart item joined with its live product data for display and pricing. */
export type CartItemWithProduct = CartItemRow & {
  product: Pick<
    ProductRow,
    | "id"
    | "name"
    | "slug"
    | "price"
    | "stock_quantity"
    | "image_url"
    | "fabric"
    | "is_active"
  > | null;
};

export type CartWithItems = CartRow & {
  items: CartItemWithProduct[];
};

export type CartSummary = {
  cartId: string;
  itemCount: number;
  subtotal: number;
  items: {
    id: string;
    productId: string;
    quantity: number;
    name: string;
    slug: string;
    price: number;
    image: string | null;
    fabric: string | null;
    stock: number;
    subtotal: number;
  }[];
};

/**
 * Get the current user's active cart, creating one on first access. Reads rely
 * on RLS so the requester's session is authoritative. Product data is joined
 * live so prices/stock are never stale.
 */
export async function getOrCreateActiveCart(userId: string): Promise<CartWithItems> {
  const supabase = await createSupabaseClient();

  const { data: existing, error: readError } = await supabase
    .from("carts")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (readError) {
    throw new ServiceError("CART_READ_FAILED", "Failed to load your cart.");
  }

  if (existing) {
    return loadCartWithItems(existing);
  }

  const { data: created, error: insertError } = await supabase
    .from("carts")
    .insert({ user_id: userId, status: "active" })
    .select("*")
    .single();

  if (insertError) {
    throw new ServiceError("CART_CREATE_FAILED", "Failed to create your cart.");
  }

  return loadCartWithItems(created);
}

/** Fetch a cart's line items joined with live product data. */
async function loadCartWithItems(cart: CartRow): Promise<CartWithItems> {
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("cart_items")
    .select(
      "*, products(id, name, slug, price, stock_quantity, image_url, fabric, is_active)",
    )
    .eq("cart_id", cart.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw new ServiceError("CART_ITEMS_READ_FAILED", "Failed to load cart items.");
  }

  return { ...cart, items: data as CartItemWithProduct[] };
}

/**
 * Add a product to the cart. Validates product existence/activity and current
 * stock before writing; increasing an existing line re-checks available stock.
 */
export async function addToCart(
  userId: string,
  input: AddToCartInput,
): Promise<CartSummary> {
  const parsed = addToCartSchema.parse(input);
  const cart = await getOrCreateActiveCart(userId);

  const product = await fetchTrustedProduct(parsed.productId);

  const existing = cart.items.find((i) => i.product_id === parsed.productId);

  if (existing) {
    const newQuantity = existing.quantity + parsed.quantity;
    assertStock(product, newQuantity);
    return updateItemQuantity(cart.id, existing.id, newQuantity);
  }

  assertStock(product, parsed.quantity);

  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("cart_items").insert({
    cart_id: cart.id,
    product_id: product.id,
    quantity: parsed.quantity,
  });

  if (error) {
    throw new ServiceError("CART_ADD_FAILED", "Failed to add item to your cart.");
  }

  const refreshed = await getOrCreateActiveCart(userId);
  return summarizeCart(refreshed);
}

/**
 * Update the quantity of an existing cart item, re-checking available stock.
 */
export async function updateCartItem(
  userId: string,
  input: UpdateCartItemInput,
): Promise<CartSummary> {
  const parsed = updateCartItemSchema.parse(input);
  const cart = await getOrCreateActiveCart(userId);

  const item = cart.items.find((i) => i.id === parsed.itemId);
  if (!item) {
    throw new ServiceError("CART_ITEM_NOT_FOUND", "That cart item no longer exists.");
  }

  const product = await fetchTrustedProduct(item.product_id);
  assertStock(product, parsed.quantity);

  return updateItemQuantity(cart.id, item.id, parsed.quantity);
}

/** Remove a single item from the cart. */
export async function removeCartItem(
  userId: string,
  input: RemoveCartItemInput,
): Promise<CartSummary> {
  const parsed = removeCartItemSchema.parse(input);
  const cart = await getOrCreateActiveCart(userId);

  const item = cart.items.find((i) => i.id === parsed.itemId);
  if (!item) {
    throw new ServiceError("CART_ITEM_NOT_FOUND", "That cart item no longer exists.");
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("id", item.id)
    .eq("cart_id", cart.id);

  if (error) {
    throw new ServiceError("CART_REMOVE_FAILED", "Failed to remove item from your cart.");
  }

  const refreshed = await getOrCreateActiveCart(userId);
  return summarizeCart(refreshed);
}

/** Clear all items from the active cart. */
export async function clearCart(userId: string): Promise<CartSummary> {
  const cart = await getOrCreateActiveCart(userId);

  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("cart_items").delete().eq("cart_id", cart.id);

  if (error) {
    throw new ServiceError("CART_CLEAR_FAILED", "Failed to clear your cart.");
  }

  const refreshed = await getOrCreateActiveCart(userId);
  return summarizeCart(refreshed);
}

/** Return a safe CartSummary for the user's active cart (no stale pricing). */
export async function getCartSummary(userId: string): Promise<CartSummary> {
  const cart = await getOrCreateActiveCart(userId);
  return summarizeCart(cart);
}

/**
 * Read-only cart summary that never creates a cart row. Used for navbar badge
 * counts and other views where we do not want to write before the user acts.
 */
export async function getCartSummaryIfExists(userId: string): Promise<CartSummary | null> {
  const supabase = await createSupabaseClient();

  const { data: cart, error } = await supabase
    .from("carts")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new ServiceError("CART_READ_FAILED", "Failed to load your cart.");
  }

  if (!cart) return null;

  const withItems = await loadCartWithItems(cart);
  return summarizeCart(withItems);
}

/** Return the active cart with full item+product data (client-facing pricing). */
export async function getActiveCart(userId: string): Promise<CartWithItems> {
  return getOrCreateActiveCart(userId);
}

/**
 * Revalidate every cart item against the current trusted product data,
 * dropping items whose product is inactive or no longer in stock, and returns
 * the corrected summary. Used before checkout.
 */
export async function validateCart(
  userId: string,
): Promise<{ valid: boolean; summary: CartSummary; issues: string[] }> {
  const cart = await getOrCreateActiveCart(userId);
  const issues: string[] = [];
  let changed = false;

  const supabase = await createSupabaseClient();

  for (const item of cart.items) {
    const product = item.product;

    if (!product || !product.is_active || product.stock_quantity <= 0) {
      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("id", item.id)
        .eq("cart_id", cart.id);
      if (error) {
        throw new ServiceError("CART_VALIDATE_FAILED", "Failed to reconcile your cart.");
      }
      changed = true;
      continue;
    }

    if (item.quantity > product.stock_quantity) {
      const { error } = await supabase
        .from("cart_items")
        .update({ quantity: product.stock_quantity })
        .eq("id", item.id)
        .eq("cart_id", cart.id);
      if (error) {
        throw new ServiceError("CART_VALIDATE_FAILED", "Failed to reconcile your cart.");
      }
      changed = true;
      issues.push(
        `${product.name} was reduced to the available stock of ${product.stock_quantity}.`,
      );
    }
  }

  const refreshed = await getOrCreateActiveCart(userId);
  const summary = summarizeCart(refreshed);

  return { valid: summary.items.length > 0 && !changed, summary, issues };
}

/**
 * Verify that a cart can move forward to checkout: every product is active,
 * in stock and the requested quantities are within stock. Never trusts client
 * prices — only the live product data is authoritative.
 */
export async function verifyCheckoutCart(
  userId: string,
): Promise<{ ok: boolean; summary: CartSummary; errors: string[] }> {
  const cart = await getOrCreateActiveCart(userId);
  const errors: string[] = [];

  if (cart.items.length === 0) {
    return { ok: false, summary: summarizeCart(cart), errors: ["Your cart is empty."] };
  }

  for (const item of cart.items) {
    const product = item.product;
    if (!product) {
      errors.push("One of the items in your cart no longer exists.");
      continue;
    }
    if (!product.is_active) {
      errors.push(`${product.name} is no longer available.`);
      continue;
    }
    if (product.stock_quantity <= 0) {
      errors.push(`${product.name} is currently out of stock.`);
      continue;
    }
    if (item.quantity > product.stock_quantity) {
      errors.push(
        `Only ${product.stock_quantity} of ${product.name} are available. Please adjust your quantity.`,
      );
    }
  }

  return { ok: errors.length === 0, summary: summarizeCart(cart), errors };
}

/** Fetch a product row directly (bypassing the active-only storefront filter). */
async function fetchTrustedProduct(productId: string): Promise<ProductRow> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    throw new ServiceError("PRODUCT_READ_FAILED", "Failed to load product.");
  }

  if (!data) {
    throw new ServiceError("PRODUCT_NOT_FOUND", "That product no longer exists.");
  }

  return data;
}

function assertStock(product: ProductRow, quantity: number): void {
  if (!product.is_active) {
    throw new ServiceError("PRODUCT_INACTIVE", "This product is no longer available.");
  }
  if (product.stock_quantity <= 0) {
    throw new ServiceError("PRODUCT_OUT_OF_STOCK", "This product is currently out of stock.");
  }
  if (quantity > product.stock_quantity) {
    throw new ServiceError(
      "PRODUCT_INSUFFICIENT_STOCK",
      `Only ${product.stock_quantity} of this item are available.`,
    );
  }
}

async function updateItemQuantity(
  cartId: string,
  itemId: string,
  quantity: number,
): Promise<CartSummary> {
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("cart_items")
    .update({ quantity })
    .eq("id", itemId)
    .eq("cart_id", cartId);

  if (error) {
    throw new ServiceError("CART_UPDATE_FAILED", "Failed to update your cart.");
  }

  const cart = await getOrCreateActiveCart(
    (await supabase.from("carts").select("user_id").eq("id", cartId).single()).data
      ?.user_id ?? "",
  );
  return summarizeCart(cart);
}

/** Compute a safe summary (subtotal/item count) from live product prices. */
export function summarizeCart(cart: CartWithItems): CartSummary {
  const items = cart.items
    .filter((i) => i.product && i.product.is_active)
    .map((i) => {
      const product = i.product as NonNullable<CartItemWithProduct["product"]>;
      return {
        id: i.id,
        productId: product.id,
        quantity: i.quantity,
        name: product.name,
        slug: product.slug,
        price: Number(product.price),
        image: product.image_url,
        fabric: product.fabric,
        stock: product.stock_quantity,
        subtotal: Number(product.price) * i.quantity,
      };
    });

  return {
    cartId: cart.id,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: items.reduce((sum, i) => sum + i.subtotal, 0),
    items,
  };
}
