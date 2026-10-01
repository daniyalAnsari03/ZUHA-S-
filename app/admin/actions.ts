"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ServiceError } from "@/services/base";
import sharp from "sharp";
import {
  createCategory,
  deleteCategory,
  setCategoryActive,
  updateCategory,
} from "@/services/categories/categories-service";
import {
  createProduct,
  deleteProduct,
  setProductActive,
  updateProduct,
  updateStock,
} from "@/services/products/products-service";
import { maybeAlertAdminOnStockCrossing } from "@/services/notifications/notification-service";
import {
  upsertCmsContent,
  type AnnouncementItem,
  type HeroSlideData,
  type HomepageContent,
} from "@/services/cms/cms-service";

export type ActionResult =
  { ok: true; message?: string } | { ok: false; error: string };

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
        compareAtPrice:
          compareAtRaw === "" ? null : numberField(formData, "compareAtPrice"),
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
    await updateProduct({ id: user.id, role: user.role }, id, {
      name: field(formData, "name"),
      slug: field(formData, "slug"),
      description: field(formData, "description"),
      fabric: field(formData, "fabric"),
      embroidery: field(formData, "embroidery"),
      color: field(formData, "color"),
      label: field(formData, "label"),
      categoryId: optionalField(formData, "categoryId"),
      price: numberField(formData, "price"),
      compareAtPrice:
        compareAtRaw === "" ? null : numberField(formData, "compareAtPrice"),
      sku: field(formData, "sku"),
      stockQuantity: numberField(formData, "stockQuantity"),
      lowStockThreshold: numberField(formData, "lowStockThreshold", 5),
      imageUrl: field(formData, "imageUrl"),
      isActive: checkField(formData, "isActive"),
      isFeatured: checkField(formData, "isFeatured"),
      sortOrder: numberField(formData, "sortOrder"),
    });
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
  revalidatePath("/admin/inventory");
}

/** Adjust stock safely. Sets an absolute stock quantity with validation. */
export async function updateStockAction(
  productId: string,
  stockQuantity: number,
  lowStockThreshold: number,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return { ok: false, error: "Admin access required." };
  }

  if (
    !Number.isInteger(stockQuantity) ||
    stockQuantity < 0 ||
    !Number.isInteger(lowStockThreshold) ||
    lowStockThreshold < 0
  ) {
    return { ok: false, error: "Stock must be a whole number of 0 or more." };
  }

  try {
    const { getProductById } =
      await import("@/services/products/products-service");
    const before = await getProductById(productId);

    await updateStock({ id: user.id, role: user.role }, productId, {
      stockQuantity,
      lowStockThreshold,
    });

    if (before) {
      await maybeAlertAdminOnStockCrossing(
        before.stock_quantity,
        stockQuantity,
        lowStockThreshold,
        before.name,
        productId,
      );
    }
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
  revalidatePath("/admin");
  return { ok: true, message: "Stock updated." };
}

/** Delete a product. Safe with order history (FK on order_items is set null). */
export async function deleteProductAction(
  productId: string,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return { ok: false, error: "Admin access required." };
  }

  try {
    await deleteProduct({ id: user.id, role: user.role }, productId);
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  return { ok: true, message: "Product deleted." };
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
        mobileImageUrl: field(formData, "mobileImageUrl"),
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
    await updateCategory({ id: user.id, role: user.role }, id, {
      name: field(formData, "name"),
      slug: field(formData, "slug"),
      description: field(formData, "description"),
      imageUrl: field(formData, "imageUrl"),
      mobileImageUrl: field(formData, "mobileImageUrl"),
      isActive: checkField(formData, "isActive"),
      sortOrder: numberField(formData, "sortOrder"),
    });
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

/** Delete a category. Blocked server-side when products still reference it. */
export async function deleteCategoryAction(
  categoryId: string,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return { ok: false, error: "Admin access required." };
  }

  try {
    await deleteCategory({ id: user.id, role: user.role }, categoryId);
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }

  revalidatePath("/admin/categories");
  return { ok: true, message: "Category deleted." };
}

/* ---------------------------------------------------------------------------
 * Media / Image Upload
 * --------------------------------------------------------------------- */

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Image optimization settings
//
// These images are shown full-bleed, edge to edge, on the homepage slides. A
// 1920px cap is the reason those slides looked pixelated: on a 2560px or 3840px
// display the browser upscales a 1920px candidate, and the candidate had itself
// already been thrown away from a 4032px phone photo and re-encoded. Sharp
// therefore keeps the longest side at 3200px, which covers a 4K panel at 1x
// with room to spare, and re-encodes at 90 rather than 80 so the step down is
// not the thing your eye catches. Measured on the project's own photography in
// tests/qa/image-compression-compare.mjs.
const MAX_WIDTH = 3200;
const MAX_HEIGHT = 3200;
const WEBP_QUALITY = 90;

export type UploadImageResult =
  { ok: true; path: string; publicUrl: string } | { ok: false; error: string };

async function optimizeImage(
  file: File,
): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);

  // SVG files pass through without optimization (sharp doesn't handle SVG well for all cases)
  if (file.type === "image/svg+xml") {
    return { buffer: inputBuffer, contentType: "image/svg+xml", extension: "svg" };
  }

  const image = sharp(inputBuffer);
  const metadata = await image.metadata();

  // Resize if larger than max dimensions
  let pipeline = image;
  if ((metadata.width ?? 0) > MAX_WIDTH || (metadata.height ?? 0) > MAX_HEIGHT) {
    pipeline = pipeline.resize(MAX_WIDTH, MAX_HEIGHT, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  // Convert to WebP for optimal compression (except GIF which may be animated)
  if (file.type !== "image/gif") {
    pipeline = pipeline.webp({ quality: WEBP_QUALITY });
    return { buffer: await pipeline.toBuffer(), contentType: "image/webp", extension: "webp" };
  }

  // For GIF, preserve format but still resize if needed
  return { buffer: await pipeline.toBuffer(), contentType: "image/gif", extension: "gif" };
}

export async function uploadImageAction(
  formData: FormData,
): Promise<UploadImageResult> {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return { ok: false, error: "Admin access required." };
  }

  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string) || "uploads";

  if (!file || !(file instanceof File)) {
    return { ok: false, error: "No file provided." };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      ok: false,
      error: `Unsupported file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF, SVG.`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: "File too large. Maximum size is 5MB." };
  }

  const timestamp = Date.now();
  const safeName = file.name
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/_+/g, "_");

  // Optimize image before upload
  let optimizedBuffer: Buffer;
  let contentType: string;
  let extension: string;

  try {
    const optimized = await optimizeImage(file);
    optimizedBuffer = optimized.buffer;
    contentType = optimized.contentType;
    extension = optimized.extension;
  } catch (optimizeError) {
    return {
      ok: false,
      error: `Image optimization failed: ${optimizeError instanceof Error ? optimizeError.message : "Unknown error"}`,
    };
  }

  // Use optimized filename with webp extension for non-GIF/SVG
  const finalExtension = extension === "svg" ? "svg" : extension;
  const baseName = safeName.replace(/\.[^.]+$/, "");
  const path = `${folder}/${timestamp}-${baseName}.${finalExtension}`;

  try {
    const supabase = await createClient();

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, optimizedBuffer, { contentType, upsert: false });

    if (uploadError) {
      return { ok: false, error: `Upload failed: ${uploadError.message}` };
    }

    const { data: urlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(path);

    return { ok: true, path, publicUrl: urlData.publicUrl };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Upload failed.",
    };
  }
}

export type MediaFile = {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: Record<string, unknown>;
  bucket_id: string;
  size: number;
};

export type ListMediaResult =
  { ok: true; files: MediaFile[] } | { ok: false; error: string };

export async function listMediaAction(
  folder?: string,
): Promise<ListMediaResult> {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return { ok: false, error: "Admin access required." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from("product-images")
      .list(folder || "", {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      return { ok: false, error: error.message };
    }

    const files: MediaFile[] = (data || []).map((f) => ({
      name: f.name,
      id: f.id || "",
      updated_at: f.updated_at || "",
      created_at: f.created_at || "",
      last_accessed_at: f.last_accessed_at || "",
      metadata: (f.metadata as Record<string, unknown>) || {},
      bucket_id: f.bucket_id || "",
      size: f.metadata?.size ? Number(f.metadata.size) : 0,
    }));

    return { ok: true, files };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to list media.",
    };
  }
}

export async function deleteMediaAction(
  paths: string[],
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return { ok: false, error: "Admin access required." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.storage
      .from("product-images")
      .remove(paths);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, message: "Images deleted." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Delete failed.",
    };
  }
}

/* ---------------------------------------------------------------------------
 * CMS Content
 * --------------------------------------------------------------------- */

export async function saveCmsAnnouncementsAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const raw = field(formData, "data");
  if (!raw) return { ok: false, error: "No data provided." };

  try {
    const parsed = JSON.parse(raw) as AnnouncementItem[];
    await upsertCmsContent(
      { id: user.id, role: user.role },
      "announcements",
      parsed as unknown as Record<string, unknown>,
    );
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }

  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true, message: "Announcements saved." };
}

export async function saveCmsHeroAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const raw = field(formData, "data");
  if (!raw) return { ok: false, error: "No data provided." };

  try {
    const parsed = JSON.parse(raw) as HeroSlideData;
    await upsertCmsContent(
      { id: user.id, role: user.role },
      "hero",
      parsed as unknown as Record<string, unknown>,
    );
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }

  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true, message: "Hero saved." };
}

export async function saveCmsHomepageAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const raw = field(formData, "data");
  if (!raw) return { ok: false, error: "No data provided." };

  try {
    const parsed = JSON.parse(raw) as HomepageContent;
    await upsertCmsContent(
      { id: user.id, role: user.role },
      "homepage",
      parsed as unknown as Record<string, unknown>,
    );
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }

  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true, message: "Homepage content saved." };
}

/* ---------------------------------------------------------------------------
 * Admin notifications
 * --------------------------------------------------------------------- */

export type AdminNotificationsResult = {
  ok: true;
  notifications: Awaited<
    ReturnType<
      typeof import("@/services/notifications/notification-service").listNotifications
    >
  >;
  unreadCount: number;
};

export async function getAdminNotificationsAction(options?: {
  unreadOnly?: boolean;
  limit?: number;
}): Promise<AdminNotificationsResult | ActionResult> {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return { ok: false, error: "Admin access required." };
  }

  try {
    const ns = await import("@/services/notifications/notification-service");
    const [notifications, unreadCount] = await Promise.all([
      ns.listNotifications(user.id, options),
      ns.getUnreadCount(user.id),
    ]);
    return { ok: true, notifications, unreadCount };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

export async function markAdminNotificationReadAction(
  notificationId: string,
): Promise<void> {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") return;

  try {
    const { markAsRead } =
      await import("@/services/notifications/notification-service");
    await markAsRead(user.id, notificationId);
  } catch (error) {
    console.error("[admin] mark notification read failed:", error);
  }
}

export async function markAdminAllNotificationsReadAction(): Promise<void> {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") return;

  try {
    const { markAllAsRead } =
      await import("@/services/notifications/notification-service");
    await markAllAsRead(user.id);
    revalidatePath("/admin/notifications");
  } catch (error) {
    console.error("[admin] mark all notifications read failed:", error);
  }
}

/** Sign out from the admin panel and return to the storefront. */
export async function adminSignOutAction(): Promise<void> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  // Awaited before redirect(): redirect() throws, so an un-awaited sign-out
  // here would be orphaned and the session would survive the redirect.
  await supabase.auth.signOut();
  redirect("/");
}
