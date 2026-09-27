import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import {
  addToWishlistSchema,
  removeWishlistItemSchema,
  toggleWishlistSchema,
  type AddToWishlistInput,
  type RemoveWishlistItemInput,
  type ToggleWishlistInput,
} from "@/lib/validation/cart";
import { ServiceError } from "@/services/base";

type WishlistRow = Database["public"]["Tables"]["wishlists"]["Row"];
type WishlistItemRow = Database["public"]["Tables"]["wishlist_items"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export type WishlistItemWithProduct = WishlistItemRow & {
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

export type WishlistWithItems = WishlistRow & {
  items: WishlistItemWithProduct[];
};

export type WishlistSummary = {
  wishlistId: string;
  itemCount: number;
  productIds: string[];
  items: {
    id: string;
    productId: string;
    name: string;
    slug: string;
    price: number;
    image: string | null;
    fabric: string | null;
    stock: number;
  }[];
};

/**
 * Get the current user's wishlist, creating one on first access. Reads rely
 * on RLS so the requester's session is authoritative.
 */
export async function getOrCreateWishlist(
  userId: string,
): Promise<WishlistWithItems> {
  const supabase = await createSupabaseClient();

  const { data: existing, error: readError } = await supabase
    .from("wishlists")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) {
    throw new ServiceError(
      "WISHLIST_READ_FAILED",
      "Failed to load your wishlist.",
      readError,
    );
  }

  if (existing) {
    return loadWishlistWithItems(existing);
  }

  const { data: created, error: insertError } = await supabase
    .from("wishlists")
    .insert({ user_id: userId })
    .select("*")
    .single();

  if (insertError) {
    throw new ServiceError(
      "WISHLIST_CREATE_FAILED",
      "Failed to create your wishlist.",
      insertError,
    );
  }

  return loadWishlistWithItems(created);
}

async function loadWishlistWithItems(
  wishlist: WishlistRow,
): Promise<WishlistWithItems> {
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("wishlist_items")
    .select(
      // `product:products(...)` aliases the embedded resource. Without the
      // alias PostgREST returns the to-one embed under the *table* name
      // (`products`), so every `item.product` read below was `undefined` and
      // the whole wishlist was filtered out — items appeared to save but never
      // appeared on /wishlist. This matches the alias used by the cart service.
      "*, product:products(id, name, slug, price, stock_quantity, image_url, fabric, is_active)",
    )
    .eq("wishlist_id", wishlist.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw new ServiceError(
      "WISHLIST_ITEMS_READ_FAILED",
      "Failed to load wishlist items.",
      error,
    );
  }

  return {
    ...wishlist,
    items: normalizeWishlistItems(data),
  };
}

/**
 * Normalize embedded wishlist rows.
 *
 * The generated `Database` types carry no relationship metadata
 * (`Relationships: []`), so supabase-js cannot type the embed and every read
 * here has to be asserted by hand. A missing/renamed embed key would then be
 * invisible to the compiler and silently drop every item, so the embedded
 * product is read from whichever key PostgREST actually used and a row without
 * a usable product is dropped explicitly rather than by accident.
 */
function normalizeWishlistItems(
  rows: unknown,
): WishlistItemWithProduct[] {
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as WishlistItemWithProduct & { products?: unknown };
    const embedded =
      item.product ??
      (item.products as WishlistItemWithProduct["product"] | undefined) ??
      null;
    if (!embedded || typeof embedded !== "object") return [];
    return [{ ...item, product: embedded }];
  });
}

/** Add a product to the wishlist. Duplicates are prevented by a DB constraint. */
export async function addToWishlist(
  userId: string,
  input: AddToWishlistInput,
): Promise<WishlistSummary> {
  const parsed = addToWishlistSchema.parse(input);
  await assertActiveProduct(parsed.productId);

  const wishlist = await getOrCreateWishlist(userId);

  const alreadySaved = wishlist.items.some(
    (i) => i.product_id === parsed.productId,
  );
  if (alreadySaved) {
    return summarizeWishlist(wishlist);
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("wishlist_items").insert({
    wishlist_id: wishlist.id,
    product_id: parsed.productId,
  });

  if (error) {
    throw new ServiceError(
      "WISHLIST_ADD_FAILED",
      "Failed to save item to your wishlist.",
      error,
    );
  }

  const refreshed = await getOrCreateWishlist(userId);
  return summarizeWishlist(refreshed);
}

/** Remove a product from the wishlist by its wishlist item id. */
export async function removeWishlistItem(
  userId: string,
  input: RemoveWishlistItemInput,
): Promise<WishlistSummary> {
  const parsed = removeWishlistItemSchema.parse(input);
  const wishlist = await getOrCreateWishlist(userId);

  const item = wishlist.items.find((i) => i.id === parsed.itemId);
  if (!item) {
    throw new ServiceError(
      "WISHLIST_ITEM_NOT_FOUND",
      "That wishlist item no longer exists.",
    );
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("wishlist_items")
    .delete()
    .eq("id", item.id)
    .eq("wishlist_id", wishlist.id);

  if (error) {
    throw new ServiceError(
      "WISHLIST_REMOVE_FAILED",
      "Failed to remove item from your wishlist.",
      error,
    );
  }

  const refreshed = await getOrCreateWishlist(userId);
  return summarizeWishlist(refreshed);
}

/** Remove a product from the wishlist by product id (e.g. from product detail). */
export async function removeWishlistProduct(
  userId: string,
  productId: string,
): Promise<WishlistSummary> {
  const wishlist = await getOrCreateWishlist(userId);

  const item = wishlist.items.find((i) => i.product_id === productId);
  if (!item) {
    return summarizeWishlist(wishlist);
  }

  return removeWishlistItem(userId, { itemId: item.id });
}

/**
 * Toggle a product in/out of the wishlist. Returns the resulting summary plus
 * whether the product is now saved.
 */
export async function toggleWishlist(
  userId: string,
  input: ToggleWishlistInput,
): Promise<{ saved: boolean; summary: WishlistSummary }> {
  const parsed = toggleWishlistSchema.parse(input);
  const wishlist = await getOrCreateWishlist(userId);

  const existing = wishlist.items.find(
    (i) => i.product_id === parsed.productId,
  );
  if (existing) {
    const summary = await removeWishlistItem(userId, { itemId: existing.id });
    return { saved: false, summary };
  }

  const summary = await addToWishlist(userId, { productId: parsed.productId });
  return { saved: true, summary };
}

/** Return a safe summary of the user's wishlist. */
export async function getWishlistSummary(
  userId: string,
): Promise<WishlistSummary> {
  const wishlist = await getOrCreateWishlist(userId);
  return summarizeWishlist(wishlist);
}

/**
 * Read-only wishlist summary that never creates a wishlist row. Used for
 * navbar badge counts and other views where we do not want to write first.
 */
export async function getWishlistSummaryIfExists(
  userId: string,
): Promise<WishlistSummary | null> {
  const supabase = await createSupabaseClient();

  const { data: wishlist, error } = await supabase
    .from("wishlists")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new ServiceError(
      "WISHLIST_READ_FAILED",
      "Failed to load your wishlist.",
    );
  }

  if (!wishlist) return null;

  const withItems = await loadWishlistWithItems(wishlist);
  return summarizeWishlist(withItems);
}

/** True if the given product is already saved in the user's wishlist. */
export async function isWishlisted(
  userId: string,
  productId: string,
): Promise<boolean> {
  const wishlist = await getOrCreateWishlist(userId);
  return wishlist.items.some((i) => i.product_id === productId);
}

/** Read-only version of isWishlisted that never creates a wishlist row. */
export async function isProductWishlisted(
  userId: string,
  productId: string,
): Promise<boolean> {
  const summary = await getWishlistSummaryIfExists(userId);
  if (!summary) return false;
  return summary.productIds.includes(productId);
}

async function assertActiveProduct(productId: string): Promise<void> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select("is_active")
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    throw new ServiceError(
      "PRODUCT_READ_FAILED",
      "Failed to load product.",
      error,
    );
  }
  if (!data) {
    throw new ServiceError(
      "PRODUCT_NOT_FOUND",
      "That product no longer exists.",
    );
  }
  if (!data.is_active) {
    throw new ServiceError(
      "PRODUCT_INACTIVE",
      "This product is no longer available.",
    );
  }
}

export function summarizeWishlist(
  wishlist: WishlistWithItems,
): WishlistSummary {
  const items = (wishlist.items ?? [])
    // A row without a usable embedded product is dropped explicitly. This is
    // the single choke point every wishlist read goes through, so a missing
    // embed can never quietly turn a populated wishlist into an empty page.
    .filter(
      (i): i is WishlistItemWithProduct & {
        product: NonNullable<WishlistItemWithProduct["product"]>;
      } => !!i?.product?.is_active,
    )
    .map((i) => {
      const product = i.product;
      return {
        id: i.id,
        productId: product.id,
        name: product.name,
        slug: product.slug,
        price: Number(product.price),
        image: product.image_url,
        fabric: product.fabric,
        stock: product.stock_quantity,
      };
    });

  return {
    wishlistId: wishlist.id,
    itemCount: items.length,
    productIds: items.map((i) => i.productId),
    items,
  };
}
