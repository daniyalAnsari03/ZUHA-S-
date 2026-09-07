"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { getAuthUser } from "@/lib/auth/session";
import { ServiceError } from "@/services/base";
import {
  createCategory,
  setCategoryActive,
  updateCategory,
} from "@/services/categories/categories-service";
import {
  createProduct,
  setProductActive,
  updateProduct,
} from "@/services/products/products-service";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

/* ---------------------------------------------------------------------------
 * Form readers / coercion
 * --------------------------------------------------------------------- */

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function numberField(formData: FormData, name: string, fallback = 0): number {
  const value = field(formData, name);
  if (value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function checkField(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

function optionalField(formData: FormData, name: string): string | null {
  const value = field(formData, name);
  return value === "" ? null : value;
}

function errorText(error: unknown): string {
  if (error instanceof ServiceError) return error.message;
  if (error instanceof ZodError) {
    return error.issues.map((issue) => issue.message).join(" ");
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

/* ---------------------------------------------------------------------------
 * Products
 * --------------------------------------------------------------------- */

export async function createProductAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const compareAtRaw = field(formData, "compareAtPrice");

  try {
    await createProduct(
      { id: user.id, role: user.role },
      {
        name: field(formData, "name"),
        slug: field(formData, "slug"),
        description: field(formData, "description"),
        fabric: field(formData, "fabric"),
        embroidery: field(formData, "embroidery"),
        color: field(formData, "color"),
        label: field(formData, "label"),
        categoryId: optionalField(formData, "categoryId"),
        price: numberField(formData, "price"),
        compareAtPrice: compareAtRaw === "" ? null : numberField(formData, "compareAtPrice"),
        sku: field(formData, "sku"),
        stockQuantity: numberField(formData, "stockQuantity"),
        lowStockThreshold: numberField(formData, "lowStockThreshold", 5),
        imageUrl: field(formData, "imageUrl"),
        isActive: checkField(formData, "isActive"),
        isFeatured: checkField(formData, "isFeatured"),
        sortOrder: numberField(formData, "sortOrder"),
      },
    );
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }

  revalidatePath("/admin/products");
  redirect("/admin/products?created=1");
}

export async function updateProductAction(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const compareAtRaw = field(formData, "compareAtPrice");

  try {
    await updateProduct(
      { id: user.id, role: user.role },
      id,
      {
        name: field(formData, "name"),
        slug: field(formData, "slug"),
        description: field(formData, "description"),
        fabric: field(formData, "fabric"),
        embroidery: field(formData, "embroidery"),
        color: field(formData, "color"),
        label: field(formData, "label"),
        categoryId: optionalField(formData, "categoryId"),
        price: numberField(formData, "price"),
        compareAtPrice: compareAtRaw === "" ? null : numberField(formData, "compareAtPrice"),
        sku: field(formData, "sku"),
        stockQuantity: numberField(formData, "stockQuantity"),
        lowStockThreshold: numberField(formData, "lowStockThreshold", 5),
        imageUrl: field(formData, "imageUrl"),
        isActive: checkField(formData, "isActive"),
        isFeatured: checkField(formData, "isFeatured"),
        sortOrder: numberField(formData, "sortOrder"),
      },
    );
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}/edit`);
  redirect("/admin/products?updated=1");
}

export async function toggleProductActiveAction(
  id: string,
  isActive: boolean,
): Promise<void> {
  const user = await getAuthUser();
  if (!user) return;
  try {
    await setProductActive({ id: user.id, role: user.role }, id, isActive);
  } catch (error) {
    console.error("[admin] toggle product active failed:", error);
    return;
  }
  revalidatePath("/admin/products");
}

/* ---------------------------------------------------------------------------
 * Categories
 * --------------------------------------------------------------------- */

export async function createCategoryAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  try {
    await createCategory(
      { id: user.id, role: user.role },
      {
        name: field(formData, "name"),
        slug: field(formData, "slug"),
        description: field(formData, "description"),
        imageUrl: field(formData, "imageUrl"),
        isActive: checkField(formData, "isActive"),
        sortOrder: numberField(formData, "sortOrder"),
      },
    );
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }

  revalidatePath("/admin/categories");
  redirect("/admin/categories?created=1");
}

export async function updateCategoryAction(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  try {
    await updateCategory(
      { id: user.id, role: user.role },
      id,
      {
        name: field(formData, "name"),
        slug: field(formData, "slug"),
        description: field(formData, "description"),
        imageUrl: field(formData, "imageUrl"),
        isActive: checkField(formData, "isActive"),
        sortOrder: numberField(formData, "sortOrder"),
      },
    );
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }

  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${id}/edit`);
  redirect("/admin/categories?updated=1");
}

export async function toggleCategoryActiveAction(
  id: string,
  isActive: boolean,
): Promise<void> {
  const user = await getAuthUser();
  if (!user) return;
  try {
    await setCategoryActive({ id: user.id, role: user.role }, id, isActive);
  } catch (error) {
    console.error("[admin] toggle category active failed:", error);
    return;
  }
  revalidatePath("/admin/categories");
}