import { tool, type RunContext } from "@openai/agents";
import { z } from "zod";

import type { AgentContext } from "@/agents/context";
import { getCmsContent } from "@/services/cms/cms-service";
import { listActiveCategories } from "@/services/categories/categories-service";
import {
  getProductBySlug,
  listActiveProducts,
  type ProductWithCategory,
} from "@/services/products/products-service";
import { createPublicClient } from "@/lib/supabase/server";
import { asResult } from "@/tools/shared/result";

/** Consistent PKR price formatting used across all store-facing tools. */
export function formatPrice(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `PKR ${value.toLocaleString("en-PK")}`;
}

export function formatStock(product: {
  stock_quantity: number;
  low_stock_threshold: number;
}): string {
  if (product.stock_quantity <= 0) return "Out of stock";
  if (product.stock_quantity <= product.low_stock_threshold) {
    return `Low stock — only ${product.stock_quantity} left`;
  }
  return `In stock (${product.stock_quantity} available)`;
}

function toCatalogLine(
  product: ProductWithCategory,
  opts?: { includeDescription?: boolean },
): Record<string, unknown> {
  return {
    name: product.name,
    slug: product.slug,
    id: product.id,
    sku: product.sku,
    category: product.category?.name ?? null,
    price: formatPrice(product.price),
    fabric: product.fabric,
    embroidery: product.embroidery,
    color: product.color,
    availability: formatStock(product),
    imageUrl: product.image_url,
    ...(opts?.includeDescription ? { description: product.description } : {}),
  };
}

/**
 * Public catalog + content read tools. Safe for guests, customers and admins.
 * They surface only active products and controlled CMS content.
 *
 * Every tool accepts an optional `RunContext<AgentContext>` so the SDK infers
 * `FunctionTool<AgentContext>` and the tool can be assigned to any agent.
 */

export const listCategories = tool({
  name: "list_categories",
  description:
    "List the store's product categories (e.g. Jamawar, Embroidery, Cut-Dana Embroidery, Plain, Unstitched, Lawn). Use for product discovery.",
  parameters: z.object({}),
  strict: true,
  async execute(_params: object, _runContext?: RunContext<AgentContext>) {
    const result = await asResult(() => listActiveCategories());
    if (!result.ok) return result;
    return {
      ok: true,
      data: result.data.map((category) => ({
        name: category.name,
        slug: category.slug,
      })),
    };
  },
});

export const listProducts = tool({
  name: "list_products",
  description:
    "Search the live product catalog. Supports category filter and free-text search on name, fabric, embroidery or SKU. Returns concise catalog lines (never internal notes). For 'all products' requests, call with no search and a higher limit (e.g. 20).",
  parameters: z.object({
    categorySlug: z.string().optional(),
    search: z.string().optional(),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  strict: true,
  async execute(
    { categorySlug, search, limit }: {
      categorySlug?: string;
      search?: string;
      limit?: number;
    },
    _runContext?: RunContext<AgentContext>,
  ) {
    const normalizedSearch = search?.trim() || undefined;
    const normalizedCategory = categorySlug?.trim() || undefined;
    const result = await asResult(() =>
      listActiveProducts({
        categorySlug: normalizedCategory,
        search: normalizedSearch,
        limit: limit ?? 8,
      }),
    );
    if (!result.ok) return result;
    if (result.data.length === 0) {
      return {
        ok: true,
        data: [],
        message: normalizedSearch
          ? `No products found matching "${normalizedSearch}". Try a different search term or browse by category.`
          : "No products currently available in the catalog.",
      };
    }
    return {
      ok: true,
      data: result.data.map((product) => toCatalogLine(product)),
    };
  },
});

export const getProduct = tool({
  name: "get_product",
  description:
    "Get full details for a single active product by slug (URL identifier). Includes price, fabric, embroidery, availability and description. Use after a product is identified.",
  parameters: z.object({ slug: z.string().min(1) }),
  strict: true,
  async execute(
    { slug }: { slug: string },
    _runContext?: RunContext<AgentContext>,
  ) {
    const normalizedSlug = slug.trim().toLowerCase();
    if (!normalizedSlug) {
      return {
        ok: false,
        reason: "invalid",
        message:
          "Please provide a product name, slug, or category to look up a product.",
      };
    }
    const result = await asResult(() => getProductBySlug(normalizedSlug));
    if (!result.ok) return result;
    if (!result.data) {
      return {
        ok: false,
        reason: "not_found",
        message: `No product found with slug "${normalizedSlug}". Try searching by name or category.`,
      };
    }
    return {
      ok: true,
      data: toCatalogLine(result.data, { includeDescription: true }),
    };
  },
});

export const checkAvailability = tool({
  name: "check_availability",
  description:
    "Check the current in-stock availability of one product by id. Use instead of guessing stock. Never invent stock levels.",
  parameters: z.object({ productId: z.string().min(1) }),
  strict: true,
  async execute(
    { productId }: { productId: string },
    _runContext?: RunContext<AgentContext>,
  ) {
    const normalizedId = productId.trim();
    if (!normalizedId) {
      return {
        ok: false,
        reason: "invalid",
        message:
          "Please provide a valid product ID to check availability.",
      };
    }
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, name, stock_quantity, low_stock_threshold")
      .eq("id", normalizedId)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      return {
        ok: false,
        reason: "not_found",
        message:
          "Product not found. Please check the product ID and try again.",
      };
    }

    return {
      ok: true,
      data: {
        name: data.name,
        availability: formatStock({
          stock_quantity: data.stock_quantity,
          low_stock_threshold: data.low_stock_threshold,
        }),
      },
    };
  },
});

export const getCms = tool({
  name: "get_cms_content",
  description:
    "Read controlled storefront content: 'announcements' (incl. shipping offers), 'hero' or 'homepage'. Use for delivery/shipping and store policy questions.",
  parameters: z.object({ key: z.enum(["announcements", "hero", "homepage"]) }),
  strict: true,
  async execute(
    { key }: { key: "announcements" | "hero" | "homepage" },
    _runContext?: RunContext<AgentContext>,
  ) {
    const result = await asResult(() => getCmsContent(key));
    if (!result.ok) return result;
    return { ok: true, data: result.data };
  },
});
