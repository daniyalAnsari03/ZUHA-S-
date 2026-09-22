import { revalidateTag } from "next/cache";

import type { Role } from "@/lib/auth/roles";
import {
  createClient as createSupabaseClient,
  createPublicClient,
} from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { STORE_CACHE_PROFILE, STORE_CACHE_TAGS } from "@/lib/storefront/cache";
import {
  productInputSchema,
  stockUpdateSchema,
  type ProductInput,
  type StockUpdateInput,
} from "@/lib/validation/catalog";
import { assertRole, ServiceError } from "@/services/base";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

/** Product row joined with its category for storefront display. */
export type ProductWithCategory = ProductRow & {
  category: { slug: string; name: string } | null;
};

export type ProductListOptions = {
  limit?: number;
  offset?: number;
  categorySlug?: string;
  featured?: boolean;
  search?: string;
};

/**
 * Product service.
 *
 * Reads filter to active products only. Mutations require an authorized admin
 * actor and are validated, executed and then verified with a follow-up read so
 * callers never report success without confirmation.
 */

export async function listActiveProducts(
  options: ProductListOptions = {},
): Promise<ProductWithCategory[]> {
  const {
    limit,
    offset = 0,
    categorySlug,
    featured,
    search,
  } = options;

  const supabase = createPublicClient();

  let query = supabase
    .from("products")
    .select(categorySlug ? "*, category:categories!inner(slug, name)" : "*, category:categories(slug, name)")
    .eq("is_active", true);

  if (categorySlug) {
    query = query.eq("category.slug", categorySlug);
  }

  if (featured !== undefined) {
    query = query.eq("is_featured", featured);
  }

  if (search?.trim()) {
    const term = search.trim();
    query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%,fabric.ilike.%${term}%,sku.ilike.%${term}%`);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + (limit ?? 24) - 1);

  if (error) {
    throw new ServiceError("PRODUCT_READ_FAILED", "Failed to load products.");
  }

  return data as unknown as ProductWithCategory[];
}

/**
 * Count active products matching the same filters as listActiveProducts.
 * Seeded so the AI can quote a REAL total ("there are 12 active products")
 * instead of fabricating a count that exceeds the rows it actually saw.
 */
export async function countActiveProducts(
  options: Omit<ProductListOptions, "limit" | "offset"> = {},
): Promise<number> {
  const { categorySlug, featured, search } = options;

  const supabase = createPublicClient();

  let query = supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  if (categorySlug) {
    query = query.eq("category.slug", categorySlug);
  }

  if (featured !== undefined) {
    query = query.eq("is_featured", featured);
  }

  if (search?.trim()) {
    const term = search.trim();
    query = query.or(
      `name.ilike.%${term}%,description.ilike.%${term}%,fabric.ilike.%${term}%,sku.ilike.%${term}%`,
    );
  }

  const { count, error } = await query;

  if (error) {
    throw new ServiceError("PRODUCT_COUNT_FAILED", "Failed to count products.");
  }

  return count ?? 0;
}

export async function getProductBySlug(
  slug: string,
): Promise<ProductWithCategory | null> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(slug, name)")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new ServiceError("PRODUCT_READ_FAILED", "Failed to load product.");
  }

  return data as unknown as ProductWithCategory | null;
}

export async function getProductById(
  id: string,
): Promise<ProductWithCategory | null> {
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(slug, name)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new ServiceError("PRODUCT_READ_FAILED", "Failed to load product.");
  }

  return data as unknown as ProductWithCategory | null;
}

export async function getFeaturedProducts(
  limit = 4,
): Promise<ProductWithCategory[]> {
  return listActiveProducts({ featured: true, limit });
}

export async function getNewArrivals(
  limit = 4,
): Promise<ProductWithCategory[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(slug)")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new ServiceError("PRODUCT_READ_FAILED", "Failed to load new arrivals.");
  }

  return data as unknown as ProductWithCategory[];
}

/**
 * Admin view of every product (active and inactive). Reads rely on RLS admin
 * policies, so the requester must hold an admin session.
 */
export type ListAllProductsOptions = {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
};

/**
 * Admin view of every matching product (active AND inactive) as a single
 * ARRAY. Pulling the full match set here is deliberate: this view powers the
 * admin one-page catalog page and the AI tools (catalog, inventory) that
 * iterate this array — never silently truncate it. Reads rely on RLS admin
 * policies, so the requester must hold an admin session. Optional filters
 * narrow the result, but the array contract (and full-match-set behavior) is
 * preserved regardless.
 */
export async function listAllProducts(
  actor: AdminActor,
  options: ListAllProductsOptions = {},
): Promise<ProductWithCategory[]> {
  assertRole(actor.role, ["admin"]);

  const supabase = await createSupabaseClient();

  let query = supabase
    .from("products")
    .select("*, category:categories(slug, name)");

  if (options.search?.trim()) {
    const term = `%${options.search.trim()}%`;
    query = query.or(`name.ilike.${term},sku.ilike.${term},description.ilike.${term}`);
  }

  if (options.categoryId) {
    query = query.eq("category_id", options.categoryId);
  }

  if (options.isActive !== undefined) {
    query = query.eq("is_active", options.isActive);
  }

  const { data, error } = await query
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new ServiceError("PRODUCT_READ_FAILED", "Failed to load products.");
  }

  return data as unknown as ProductWithCategory[];
}

type AdminActor = { id: string; role: Role };

export type AdminProductListOptions = {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
};

/**
 * Admin view of every product with search, optional filters, pagination and an
 * exact count. Reads rely on RLS admin policies.
 */
export async function listPagedProducts(
  actor: AdminActor,
  options: AdminProductListOptions = {},
): Promise<{ products: ProductWithCategory[]; total: number }> {
  assertRole(actor.role, ["admin"]);

  const supabase = await createSupabaseClient();
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;

  let query = supabase
    .from("products")
    .select("*, category:categories(slug, name)", { count: "exact" });

  if (options.search?.trim()) {
    const term = `%${options.search.trim()}%`;
    query = query.or(`name.ilike.${term},sku.ilike.${term},description.ilike.${term}`);
  }

  if (options.categoryId) {
    query = query.eq("category_id", options.categoryId);
  }

  if (options.isActive !== undefined) {
    query = query.eq("is_active", options.isActive);
  }

  const { data, error, count } = await query
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new ServiceError("PRODUCT_READ_FAILED", "Failed to load products.");
  }

  return {
    products: (data ?? []) as unknown as ProductWithCategory[],
    total: count ?? 0,
  };
}

export async function createProduct(
  actor: AdminActor,
  input: ProductInput,
): Promise<ProductWithCategory> {
  assertRole(actor.role, ["admin"]);
  const parsed = productInputSchema.parse(input);

  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("products")
    .insert({
      name: parsed.name,
      slug: parsed.slug,
      description: parsed.description,
      fabric: parsed.fabric,
      embroidery: parsed.embroidery,
      color: parsed.color,
      label: parsed.label,
      category_id: parsed.categoryId,
      price: parsed.price,
      compare_at_price: parsed.compareAtPrice,
      sku: parsed.sku,
      stock_quantity: parsed.stockQuantity,
      low_stock_threshold: parsed.lowStockThreshold,
      image_url: parsed.imageUrl,
      is_active: parsed.isActive,
      is_featured: parsed.isFeatured,
      sort_order: parsed.sortOrder,
    })
    .select("*")
    .single();

  if (error) {
    throw new ServiceError("PRODUCT_CREATE_FAILED", "Failed to create product.");
  }

  revalidateTag(STORE_CACHE_TAGS.products, STORE_CACHE_PROFILE);

  return withCategory(data);
}

export async function updateProduct(
  actor: AdminActor,
  id: string,
  input: ProductInput,
): Promise<ProductWithCategory> {
  assertRole(actor.role, ["admin"]);
  const parsed = productInputSchema.parse(input);

  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("products")
    .update({
      name: parsed.name,
      slug: parsed.slug,
      description: parsed.description,
      fabric: parsed.fabric,
      embroidery: parsed.embroidery,
      color: parsed.color,
      label: parsed.label,
      category_id: parsed.categoryId,
      price: parsed.price,
      compare_at_price: parsed.compareAtPrice,
      sku: parsed.sku,
      stock_quantity: parsed.stockQuantity,
      low_stock_threshold: parsed.lowStockThreshold,
      image_url: parsed.imageUrl,
      is_active: parsed.isActive,
      is_featured: parsed.isFeatured,
      sort_order: parsed.sortOrder,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new ServiceError("PRODUCT_UPDATE_FAILED", "Failed to update product.");
  }

  revalidateTag(STORE_CACHE_TAGS.products, STORE_CACHE_PROFILE);

  return withCategory(data);
}

export async function updateStock(
  actor: AdminActor,
  id: string,
  input: StockUpdateInput,
): Promise<ProductWithCategory> {
  assertRole(actor.role, ["admin"]);
  const parsed = stockUpdateSchema.parse(input);

  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("products")
    .update({
      stock_quantity: parsed.stockQuantity,
      low_stock_threshold: parsed.lowStockThreshold,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new ServiceError("PRODUCT_UPDATE_FAILED", "Failed to update stock.");
  }

  revalidateTag(STORE_CACHE_TAGS.products, STORE_CACHE_PROFILE);

  return withCategory(data);
}

export async function setProductActive(
  actor: AdminActor,
  id: string,
  isActive: boolean,
): Promise<ProductWithCategory> {
  assertRole(actor.role, ["admin"]);

  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new ServiceError("PRODUCT_UPDATE_FAILED", "Failed to update product.");
  }

  revalidateTag(STORE_CACHE_TAGS.products, STORE_CACHE_PROFILE);

  return withCategory(data);
}

/**
 * Attach the linked category (slug + name) onto a product row so every
 * mutation result reports the human-readable category — never "Not specified".
 */
async function withCategory(product: ProductRow): Promise<ProductWithCategory> {
  const joined = await getProductById(product.id);
  return joined ?? { ...product, category: null };
}

/** Hard-delete a product. High-risk; requires an authorized admin and explicit intent. */
export async function deleteProduct(
  actor: AdminActor,
  id: string,
): Promise<void> {
  assertRole(actor.role, ["admin"]);

  const supabase = await createSupabaseClient();

  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    throw new ServiceError("PRODUCT_DELETE_FAILED", "Failed to delete product.");
  }

  const { data: gone } = await supabase
    .from("products")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (gone) {
    throw new ServiceError(
      "PRODUCT_DELETE_VERIFY_FAILED",
      "Product deletion could not be verified.",
    );
  }

  revalidateTag(STORE_CACHE_TAGS.products, STORE_CACHE_PROFILE);
}