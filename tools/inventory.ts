import { tool, type RunContext } from "@openai/agents";
import { z } from "zod";

import type { AgentContext } from "@/agents/context";
import { toolRoleGuardrail, ADMIN_ROLE } from "@/guardians/authorization";
import {
  getProductById,
  listAllProducts,
  updateStock,
  type ProductWithCategory,
} from "@/services/products/products-service";
import { withToolAudit } from "@/tools/shared/audit";
import { asResult, notFound } from "@/tools/shared/result";

const adminActor = (ctx: AgentContext) => ({
  id: ctx.userId!,
  role: "admin" as const,
});

function stockLine(product: ProductWithCategory) {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    stock: product.stock_quantity,
    lowStockThreshold: product.low_stock_threshold,
    status:
      product.stock_quantity <= 0
        ? "out_of_stock"
        : product.stock_quantity <= product.low_stock_threshold
          ? "low"
          : "in_stock",
  };
}

/**
 * Admin product search — searches ALL products (active and inactive) by name,
 * SKU, fabric, embroidery, or color. Used by inventory and other admin employees
 * to resolve human-readable product references to UUIDs before mutations.
 */
export const searchProductsAdminTool = tool({
  name: "search_products_admin",
  description:
    "Search the full product catalog (active and inactive) by name, SKU, fabric, embroidery, or color. Use this BEFORE update_stock or other mutations to resolve a product name or partial name to its UUID. Returns matching products with id, name, sku, stock, category and active status.",
  parameters: z.object({
    search: z.string().min(1).max(200),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("search_products_admin", [ADMIN_ROLE])],
  async execute(
    { search, limit }: { search: string; limit?: number },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;
    const actor = adminActor(ctx);
    const normalizedSearch = search?.trim();
    if (!normalizedSearch) {
      return { ok: false, reason: "invalid", message: "Please provide a search term to find a product." } as const;
    }
    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "search_products_admin",
        actionType: "product.search.admin",
        risk: "low",
        summary: `Admin search "${normalizedSearch}"`,
      },
      async () => {
        const allProducts = await asResult(() => listAllProducts(actor));
        if (!allProducts.ok) return allProducts;

        const needle = normalizedSearch.toLowerCase();
        const matches = allProducts.data.filter((p) => {
          const searchable = [
            p.name,
            p.sku,
            p.fabric,
            p.embroidery,
            p.color,
            p.category?.name,
            p.description,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return searchable.includes(needle);
        });

        const maxResults = limit ?? 10;
        return {
          ok: true as const,
          data: matches.slice(0, maxResults).map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            sku: p.sku,
            category: p.category?.name ?? null,
            price: p.price,
            stock: p.stock_quantity,
            active: p.is_active,
          })),
          totalMatches: matches.length,
        };
      },
      (data) => {
        // A single unambiguous match becomes the conversation focus so later
        // "iska stock" / "ismein" follow-ups resolve to the right product.
        const rows = data as unknown as { id: string }[];
        if (rows.length === 1 && rows[0]?.id) {
          return { entityType: "product", entityId: rows[0].id };
        }
        return null;
      },
    );
    return result;
  },
});

export const updateStockTool = tool({
  name: "update_stock",
  description:
    "Set the exact stock quantity for a product by id. Overwrites current stock with the given value. The low-stock threshold is optional: when omitted it keeps the product's current threshold. Returns the verified new stock state.",
  parameters: z.object({
    id: z.string().uuid(),
    stockQuantity: z.number().int().min(0).max(1_000_000),
    lowStockThreshold: z.number().int().min(0).max(1_000_000).optional(),
  }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("update_stock", [ADMIN_ROLE])],
  async execute(
    { id, stockQuantity, lowStockThreshold }: {
      id: string;
      stockQuantity: number;
      lowStockThreshold?: number;
    },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;
    const actor = adminActor(ctx);
    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "update_stock",
        actionType: "inventory.stock.update",
        risk: "medium",
        entityType: "product",
        entityId: id,
        summary: `Set stock to ${stockQuantity}`,
      },
      async () => {
        const current = await asResult(() => getProductById(id));
        if (!current.ok) return current;
        if (!current.data) {
          return notFound(`No product found with id "${id}".`);
        }
        // Preserve the existing threshold when the model does not supply one
        // instead of silently resetting it to the schema default of 5.
        const threshold =
          lowStockThreshold ?? current.data.low_stock_threshold;
        return asResult(() =>
          updateStock(actor, id, {
            stockQuantity,
            lowStockThreshold: threshold,
          }),
        );
      },
    );
    if (!result.ok) return result;
    return { ok: true, data: stockLine(result.data as ProductWithCategory) };
  },
});

export const listLowStockProducts = tool({
  name: "list_low_stock_products",
  description:
    "List every product whose current stock is at or below its low-stock threshold (including out-of-stock items). Use for inventory monitoring.",
  parameters: z.object({}),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("list_low_stock_products", [ADMIN_ROLE])],
  async execute(_params: object, runContext?: RunContext<AgentContext>) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;
    const actor = adminActor(ctx);
    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "list_low_stock_products",
        actionType: "inventory.low_stock.read",
        risk: "low",
        summary: "List low-stock products",
      },
      async () => {
        const rows = await asResult(() => listAllProducts(actor));
        if (!rows.ok) return rows;
        const low = rows.data.filter(
          (p) => p.stock_quantity <= p.low_stock_threshold,
        );
        return { ok: true as const, data: low.map(stockLine) };
      },
    );
    return result;
  },
});
