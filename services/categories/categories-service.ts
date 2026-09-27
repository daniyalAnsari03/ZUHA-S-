import { revalidateTag } from "next/cache";

import type { Role } from "@/lib/auth/roles";
import {
  createClient as createSupabaseClient,
  createPublicClient,
} from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { STORE_CACHE_PROFILE, STORE_CACHE_TAGS } from "@/lib/storefront/cache";
import {
  categoryInputSchema,
  type CategoryInput,
} from "@/lib/validation/catalog";
import { assertRole, ServiceError } from "@/services/base";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

/**
 * Category service.
 *
 * Reads are served through the RLS-aware client (public rows only). Mutations
 * require an authorized admin actor, are validated with Zod, executed through
 * the RLS-aware client (admin policies) and verified with a follow-up read.
 */

export async function listActiveCategories(): Promise<CategoryRow[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new ServiceError(
      "CATEGORY_READ_FAILED",
      "Failed to load categories.",
    );
  }

  return data;
}

/**
 * Admin view of every category (active and inactive). Reads rely on RLS admin
 * policies, so the requester must hold an admin session.
 */
export async function listAllCategories(
  actor: AdminActor,
): Promise<CategoryRow[]> {
  assertRole(actor.role, ["admin"]);

  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new ServiceError(
      "CATEGORY_READ_FAILED",
      "Failed to load categories.",
    );
  }

  return data;
}

export async function getCategoryBySlug(
  slug: string,
): Promise<CategoryRow | null> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new ServiceError("CATEGORY_READ_FAILED", "Failed to load category.");
  }

  return data;
}

export async function getCategoryById(id: string): Promise<CategoryRow | null> {
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new ServiceError("CATEGORY_READ_FAILED", "Failed to load category.");
  }

  return data;
}

type AdminActor = { id: string; role: Role };

export async function createCategory(
  actor: AdminActor,
  input: CategoryInput,
): Promise<CategoryRow> {
  assertRole(actor.role, ["admin"]);
  const parsed = categoryInputSchema.parse(input);

  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("categories")
    .insert({
      name: parsed.name,
      slug: parsed.slug,
      description: parsed.description,
      image_url: parsed.imageUrl,
      is_active: parsed.isActive,
      sort_order: parsed.sortOrder,
    })
    .select("*")
    .single();

  if (error) {
    throw new ServiceError(
      "CATEGORY_CREATE_FAILED",
      "Failed to create category.",
    );
  }

  revalidateTag(STORE_CACHE_TAGS.categories, STORE_CACHE_PROFILE);

  return data;
}

export async function updateCategory(
  actor: AdminActor,
  id: string,
  input: CategoryInput,
): Promise<CategoryRow> {
  assertRole(actor.role, ["admin"]);
  const parsed = categoryInputSchema.parse(input);

  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("categories")
    .update({
      name: parsed.name,
      slug: parsed.slug,
      description: parsed.description,
      image_url: parsed.imageUrl,
      is_active: parsed.isActive,
      sort_order: parsed.sortOrder,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new ServiceError(
      "CATEGORY_UPDATE_FAILED",
      "Failed to update category.",
    );
  }

  revalidateTag(STORE_CACHE_TAGS.categories, STORE_CACHE_PROFILE);

  return data;
}

export async function setCategoryActive(
  actor: AdminActor,
  id: string,
  isActive: boolean,
): Promise<CategoryRow> {
  assertRole(actor.role, ["admin"]);

  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("categories")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new ServiceError(
      "CATEGORY_UPDATE_FAILED",
      "Failed to update category.",
      error,
    );
  }

  revalidateTag(STORE_CACHE_TAGS.categories, STORE_CACHE_PROFILE);

  return data;
}

/**
 * Delete a category, but only when it has no products referencing it.
 *
 * Deleting a referenced category would silently detach products, which the
 * business rules explicitly reject ("do not allow category deletion to
 * silently break existing products"). The admin must first move or remove the
 * products, then delete the empty category.
 */
export async function deleteCategory(
  actor: AdminActor,
  id: string,
): Promise<void> {
  assertRole(actor.role, ["admin"]);

  const supabase = await createSupabaseClient();

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id")
    .eq("category_id", id)
    .limit(1);

  if (productsError) {
    throw new ServiceError(
      "CATEGORY_DELETE_FAILED",
      "Failed to check category usage.",
      productsError,
    );
  }

  if ((products ?? []).length > 0) {
    throw new ServiceError(
      "CATEGORY_DELETE_BLOCKED",
      "This category still has products. Reassign or delete them before deleting the category.",
    );
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    throw new ServiceError(
      "CATEGORY_DELETE_FAILED",
      "Failed to delete category.",
      error,
    );
  }

  const { data: gone } = await supabase
    .from("categories")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (gone) {
    throw new ServiceError(
      "CATEGORY_DELETE_VERIFY_FAILED",
      "Category deletion could not be verified.",
    );
  }

  revalidateTag(STORE_CACHE_TAGS.categories, STORE_CACHE_PROFILE);
}
