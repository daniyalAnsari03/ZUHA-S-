import { tool, type RunContext } from "@openai/agents";
import { z } from "zod";

import type { AgentContext } from "@/agents/context";
import { toolRoleGuardrail, ADMIN_ROLE } from "@/guardians/authorization";
import { type ProductInput } from "@/lib/validation/catalog";
import {
  createProduct,
  deleteProduct,
  getProductById,
  setProductActive,
  updateProduct,
  type ProductWithCategory,
} from "@/services/products/products-service";
import { listActiveCategories } from "@/services/categories/categories-service";
import { withToolAudit } from "@/tools/shared/audit";
import {
  asResult,
  denied,
  normalizeString,
  notFound,
  type ToolResult,
} from "@/tools/shared/result";

const adminActor = (ctx: AgentContext) => ({ id: ctx.userId!, role: "admin" as const });

const optionalText = z.string().max(2000).nullable().optional().or(z.literal(""));
const optionalShort = z.string().max(120).nullable().optional().or(z.literal(""));

const productFields = {
  name: z.string().min(1).max(160),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: optionalText,
  fabric: optionalShort,
  embroidery: optionalShort,
  color: optionalShort,
  label: optionalShort,
  categoryId: z.string().uuid().nullable().optional(),
  price: z.number().min(0).max(1_000_000_000),
  compareAtPrice: z.number().min(0).nullable().optional(),
  sku: optionalShort,
  stockQuantity: z.number().int().min(0).max(1_000_000),
  lowStockThreshold: z.number().int().min(0).max(1_000_000).default(5),
  imageUrl: optionalShort,
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
};

const productSchema = z.object(productFields);

type ProductFieldInput = z.input<typeof productSchema>;

/**
 * Update semantics: every field is required by the SDK (strict JSON schema)
 * but nullable, so the model can pass `null` for any field it does not intend
 * to change. `null` = keep the current database value; a value = apply it; an
 * empty string on a text field = clear it. Never use optional/default here —
 * defaults silently overwrite real values (e.g. sortOrder defaulting to 0
 * resets catalog order).
 */
const nullableText = (max: number) =>
  z.union([z.string().trim().max(max), z.literal(""), z.literal(null)]);

const productUpdateFields = {
  name: z.string().min(1).max(160).nullable(),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .nullable(),
  description: nullableText(2000),
  fabric: nullableText(120),
  embroidery: nullableText(120),
  color: nullableText(120),
  label: nullableText(120),
  categoryId: z.string().uuid().nullable(),
  price: z.number().min(0).max(1_000_000_000).nullable(),
  compareAtPrice: z.number().min(0).nullable(),
  sku: nullableText(120),
  stockQuantity: z.number().int().min(0).max(1_000_000).nullable(),
  lowStockThreshold: z.number().int().min(0).max(1_000_000).nullable(),
  imageUrl: nullableText(120),
  isActive: z.boolean().nullable(),
  isFeatured: z.boolean().nullable(),
  sortOrder: z.number().int().min(0).nullable(),
};

const productUpdateSchema = z.object(productUpdateFields);

type ProductUpdateInput = z.input<typeof productUpdateSchema>;

function toProductInput(fields: ProductFieldInput) {
  const empty = (
    value: string | null | undefined,
  ): string | undefined => {
    if (value === null || value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed !== "" ? trimmed : undefined;
  };

  return {
    name: fields.name,
    slug: fields.slug,
    description: empty(fields.description),
    fabric: empty(fields.fabric),
    embroidery: empty(fields.embroidery),
    color: empty(fields.color),
    label: empty(fields.label),
    categoryId: empty(fields.categoryId),
    price: fields.price,
    compareAtPrice:
      fields.compareAtPrice === null || fields.compareAtPrice === undefined
        ? undefined
        : fields.compareAtPrice,
    sku: empty(fields.sku),
    stockQuantity: fields.stockQuantity,
    lowStockThreshold: fields.lowStockThreshold,
    imageUrl: empty(fields.imageUrl),
    isActive: fields.isActive,
    isFeatured: fields.isFeatured,
    sortOrder: fields.sortOrder,
  };
}

/**
 * Merge the fields the model supplied onto the product's current database
 * values. `null` keeps the current value; a value is applied; an empty string
 * clears a text field. The result is a complete, validated ProductInput so the
 * existing full-replace service contract is preserved without silently
 * resetting untouched fields (e.g. sort_order, is_active) to schema defaults.
 */
function mergeProductInput(
  fields: ProductUpdateInput,
  current: ProductWithCategory,
): ProductInput {
  const keep = <T>(value: T | null, fallback: T): T =>
    value === null ? fallback : value;

  const text = (
    value: string | null | undefined,
    fallback: string | null,
  ): string | undefined => {
    if (value === null || value === undefined) return fallback ?? undefined;
    const trimmed = value.trim();
    // "" lets the product schema's transform map the field to null, clearing it.
    return trimmed === "" ? "" : trimmed;
  };

  return {
    name: keep(fields.name, current.name),
    slug: keep(fields.slug, current.slug),
    description: text(fields.description, current.description),
    fabric: text(fields.fabric, current.fabric),
    embroidery: text(fields.embroidery, current.embroidery),
    color: text(fields.color, current.color),
    label: text(fields.label, current.label),
    categoryId: keep(fields.categoryId, current.category_id),
    price: keep(fields.price, current.price),
    compareAtPrice: keep(fields.compareAtPrice, current.compare_at_price),
    sku: text(fields.sku, current.sku),
    stockQuantity: keep(fields.stockQuantity, current.stock_quantity),
    lowStockThreshold: keep(
      fields.lowStockThreshold,
      current.low_stock_threshold,
    ),
    imageUrl: text(fields.imageUrl, current.image_url),
    isActive: keep(fields.isActive, current.is_active),
    isFeatured: keep(fields.isFeatured, current.is_featured),
    sortOrder: keep(fields.sortOrder, current.sort_order),
  };
}

function summarizeProduct(product: ProductWithCategory | Awaited<ReturnType<typeof createProduct>>) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    category: (product as ProductWithCategory).category?.name ?? null,
    price: product.price,
    stock: product.stock_quantity,
    active: product.is_active,
  };
}

/**
 * Admin-only product mutations. Every tool is guarded at the SDK level
 * (admin-only) and again inside execution, then audited.
 */

export const createProductTool = tool({
  name: "create_product",
  description:
    "Create a new product in the catalog. Requires complete, validated product information. Prefer preparing name, description and SKU before calling. Verify the result afterwards.",
  parameters: z.object(productFields),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("create_product", [ADMIN_ROLE])],
  async execute(params, runContext?: RunContext<AgentContext>) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;
    const actor = adminActor(ctx);
    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "create_product",
        actionType: "product.create",
        risk: "medium",
        entityType: "product",
        summary: `Create product "${params.name}"`,
      },
      async () => {
        return asResult(() => createProduct(actor, toProductInput(params)));
      },
    );
    if (!result.ok) return result;
    return { ok: true, data: summarizeProduct(result.data as ProductWithCategory) };
  },
});

export const updateProductTool = tool({
  name: "update_product",
  description:
    "Update an existing product by id. Partial update: every field must be provided, but pass null for any field you do NOT intend to change (it keeps its current database value, including sort order, publish state and stock). An empty string clears a text field. Returns the updated product summary.",
  parameters: z.object({ id: z.string().uuid(), ...productUpdateFields }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("update_product", [ADMIN_ROLE])],
  async execute({ id, ...fields }, runContext?: RunContext<AgentContext>) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;
    const actor = adminActor(ctx);
    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "update_product",
        actionType: "product.update",
        risk: "medium",
        entityType: "product",
        entityId: id,
        summary: `Update product${fields.name ? ` "${fields.name}"` : ` ${id}`}`,
      },
      async () => {
        const current = await asResult(() => getProductById(id));
        if (!current.ok) return current;
        if (!current.data) {
          return notFound(`No product found with id "${id}".`);
        }
        const input = mergeProductInput(fields, current.data);
        return asResult(() => updateProduct(actor, id, input));
      },
    );
    if (!result.ok) return result;
    return { ok: true, data: summarizeProduct(result.data as ProductWithCategory) };
  },
});

export const setProductActiveTool = tool({
  name: "set_product_active",
  description:
    "Publish or unpublish a product by id. Unpublishing hides it from the storefront. Returns the product's new visibility state.",
  parameters: z.object({ id: z.string().uuid(), isActive: z.boolean() }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("set_product_active", [ADMIN_ROLE])],
  async execute(
    { id, isActive }: { id: string; isActive: boolean },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;
    const actor = adminActor(ctx);
    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "set_product_active",
        actionType: isActive ? "product.publish" : "product.unpublish",
        risk: "medium",
        entityType: "product",
        entityId: id,
        summary: `${isActive ? "Publish" : "Unpublish"} product`,
      },
      async () => asResult(() => setProductActive(actor, id, isActive)),
    );
    if (!result.ok) return result;
    return { ok: true, data: summarizeProduct(result.data as ProductWithCategory) };
  },
});

export const deleteProductTool = tool({
  name: "delete_product",
  description:
    "Permanently delete a product by id. HIGH RISK and irreversible. Use only after explicit confirmation from the owner is captured in the conversation.",
  parameters: z.object({ id: z.string().uuid(), confirm: z.literal(true) }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("delete_product", [ADMIN_ROLE])],
  async execute(
    { id }: { id: string },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;
    const actor = adminActor(ctx);
    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "delete_product",
        actionType: "product.delete",
        risk: "high",
        entityType: "product",
        entityId: id,
        summary: "Delete product permanently",
      },
      async () => asResult(() => deleteProduct(actor, id)),
    );
    if (!result.ok) return result;
    return { ok: true, data: { deleted: true, id } };
  },
});

/**
 * Category resolution helper used by tools that need a category id from a
 * human-friendly slug/name without requiring the model to guess UUIDs.
 */
export const resolveCategoryId = tool({
  name: "resolve_category",
  description:
    "Resolve a category name (e.g. 'Jamawar', 'Embroidery') to its id and slug. Use before creating or updating a product when a category is specified.",
  parameters: z.object({
    nameOrSlug: z.string().min(1),
  }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("resolve_category", [ADMIN_ROLE])],
  async execute(
    { nameOrSlug }: { nameOrSlug: string },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;

    const normalized = normalizeString(nameOrSlug);
    if (!normalized) {
      return {
        ok: false,
        reason: "invalid",
        message: "Please provide a category name or slug to resolve.",
      };
    }

    const actor = adminActor(ctx);
    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "resolve_category",
        actionType: "category.resolve",
        risk: "low",
        summary: `Resolve category "${normalized}"`,
      },
      async (): Promise<ToolResult<{ id: string; slug: string; name: string }>> => {
        const categories = await listActiveCategories();
        const needle = normalized.toLowerCase();
        const match = categories.find(
          (c) =>
            c.slug.toLowerCase() === needle ||
            c.name.toLowerCase() === needle,
        );
        if (!match) {
          return denied(
            `Category "${normalized}" was not found. Known categories: ${categories
              .map((c) => c.name)
              .join(", ")}.`,
          );
        }
        return { ok: true, data: { id: match.id, slug: match.slug, name: match.name } };
      },
    );
    return result;
  },
});
