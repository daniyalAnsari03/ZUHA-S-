import { tool, type RunContext } from "@openai/agents";
import { z } from "zod";

import type { AgentContext } from "@/agents/context";
import {
  toolRoleGuardrail,
  ADMIN_ROLE,
  CUSTOMER_ROLE,
} from "@/guardians/authorization";
import {
  getPendingDraft,
  missingDraftFields,
  setPendingDraft,
  type PendingDraft,
  type PendingDraftKind,
} from "@/services/ai/draft-service";
import { withToolAudit } from "@/tools/shared/audit";
import {
  invalid,
  ok,
  type ToolResult,
} from "@/tools/shared/result";

/**
 * Pending-draft tools.
 *
 * These back the conversation-state architecture: an agent in the middle of
 * collecting several fields for one task saves progress with a draft tool
 * after every exchange. The draft is stored per conversation and survives
 * interruptions, so the user can ask an unrelated question mid-task and the
 * agent can resume exactly where it stopped when they return.
 *
 * Every draft write is audited. Guests have no persisted conversations, so
 * drafts simply require a valid conversation in context.
 */

/** Drop null/undefined/blank values so drafts only hold meaningful field data. */
function sanitizeFields(
  fields?: Record<string, unknown> | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!fields) return out;
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    out[key] = value;
  }
  return out;
}

function draftState(draft: PendingDraft) {
  const missing = missingDraftFields(draft.kind, draft.fields);
  return {
    kind: draft.kind,
    targetId: draft.targetId ?? null,
    collected: draft.fields,
    missing,
    expect: draft.expect ?? missing[0] ?? null,
    complete: missing.length === 0,
  };
}

/**
 * Closed field schema for pending drafts. Every key is nullable so strict
 * structured outputs can represent "field not yet provided" as null, while
 * the runtime sanitizer drops null/blank values before the draft is stored.
 * Known keys cover both product drafts (product create/edit) and checkout
 * drafts; the execute-side sanitize + per-kind REQUIRED lists decide what is
 * actually used.
 */
const draftFieldsSchema = z
  .object({
    name: z.string().max(160).nullable().optional(),
    price: z.number().min(0).nullable().optional(),
    stockQuantity: z.number().int().min(0).max(10_000_000).nullable().optional(),
    category: z.string().max(120).nullable().optional(),
    fabric: z.string().max(120).nullable().optional(),
    embroidery: z.string().max(120).nullable().optional(),
    color: z.string().max(120).nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).nullable().optional().or(z.literal("")),
    sku: z.string().max(40).nullable().optional(),
    imageUrl: z.string().max(600).nullable().optional(),
    phone: z.string().max(20).nullable().optional(),
    email: z.string().max(254).nullable().optional(),
    shippingAddress: z.string().max(500).nullable().optional(),
    city: z.string().max(120).nullable().optional(),
    postalCode: z.string().max(20).nullable().optional(),
    orderNotes: z.string().max(1000).nullable().optional(),
  })
  .strict();

/**
 * Save/update the ADMIN's pending product draft (product-create or
 * product-edit). The model should call this after every exchange where the
 * owner supplies one or more product fields, so multi-turn product work
 * survives interruptions and resumes from explicit state.
 */
export const saveProductDraftTool = tool({
  name: "save_product_draft",
  description:
    "Save or update the pending PRODUCT DRAFT for this conversation. Use whenever you are building a product over multiple turns: after every owner message that provides one or more fields, save them here. kind 'product-create' = creating a new product; kind 'product-edit' = editing an existing product (then targetId MUST be that product's UUID, resolved via search_products_admin first). fields uses keys like name, price, stockQuantity, category, fabric, embroidery, color, description, slug, imageUrl, sku. expect optionally names the single next field you are asking the owner for. Keep saving after every exchange until the draft is complete (returns 'missing: []'), then create/update the product and clear the draft with cancel_draft. If the user replies with an unrelated question mid-draft, answer it and keep the draft — never clear it unless the user says 'chhod do' / 'cancel it'.",
  parameters: z.object({
    kind: z.enum(["product-create", "product-edit"]),
    targetId: z.string().uuid().nullable().optional(),
    fields: draftFieldsSchema,
    expect: z.string().max(60).nullable().optional(),
  }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("save_product_draft", [ADMIN_ROLE])],
  async execute(
    { kind, targetId, fields, expect }: {
      kind: "product-create" | "product-edit";
      targetId?: string | null;
      fields?: Record<string, unknown> | null;
      expect?: string | null;
    },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) {
      return { ok: false, reason: "error", message: "Missing execution context." } as const;
    }
    if (!ctx.conversationId) {
      return invalid("Drafts are only available inside a saved conversation.");
    }
    if (kind === "product-edit" && !targetId) {
      return invalid(
        "For a product-edit draft you must provide targetId (the product's UUID). Resolve it with search_products_admin first.",
      );
    }

    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "save_product_draft",
        actionType: "draft.product.save",
        risk: "low",
        entityType: "product",
        entityId: targetId ?? undefined,
        summary: `Save ${kind} product draft${targetId ? ` (${targetId})` : ""}`,
      },
      async () => {
        let current: PendingDraft | null = null;
        try {
          current = await getPendingDraft(ctx.conversationId!);
        } catch {
          current = null;
        }

        if (current && current.kind !== kind) {
          return invalid(
            `A different pending ${current.kind} draft is already active in this conversation. Finish or cancel it before starting a ${kind} draft.`,
          );
        }
        if (
          kind === "product-edit" &&
          current?.targetId &&
          targetId &&
          current.targetId !== targetId
        ) {
          return invalid(
            "targetId does not match the active product-edit draft. Either keep editing that product or cancel the draft first.",
          );
        }

        const merged = {
          ...(current?.fields ?? {}),
          ...sanitizeFields(fields),
        };

        const draft: PendingDraft = {
          kind,
          fields: merged,
          targetId:
            kind === "product-edit" ? targetId ?? current?.targetId : undefined,
          expect: expect ?? missingDraftFields(kind, merged)[0] ?? undefined,
          updatedAt: new Date().toISOString(),
        };

        await setPendingDraft(ctx.conversationId!, draft);
        return ok(draftState(draft));
      },
    );
    return result;
  },
});

/**
 * Save/update the customer's pending CHECKOUT draft. Used while collecting
 * name/phone/email/address/city across turns so an interruption (e.g. a
 * product question mid-checkout) never loses the details.
 */
export const saveCheckoutDraftTool = tool({
  name: "save_checkout_draft",
  description:
    "Save or update the pending CHECKOUT DRAFT for this conversation. Use while collecting the customer's delivery details across turns: after every message that provides any of name, phone, email, shippingAddress, city (and optionally postalCode/orderNotes), save them here. Keep saving until the draft returns 'missing: []', then show the total and delivery details, ask the customer for ONE explicit confirmation, and place the order with place_cod_order (confirm=true). If the customer asks an unrelated question mid-checkout, answer it and keep the draft — never clear it unless the customer says 'chhod do' / 'cancel it'.",
  parameters: z.object({
    fields: draftFieldsSchema,
    expect: z.string().max(60).nullable().optional(),
  }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("save_checkout_draft", [CUSTOMER_ROLE])],
  async execute(
    { fields, expect }: { fields?: Record<string, unknown> | null; expect?: string | null },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) {
      return { ok: false, reason: "error", message: "Missing execution context." } as const;
    }
    if (!ctx.conversationId) {
      return invalid("Drafts are only available inside a saved conversation.");
    }

    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "save_checkout_draft",
        actionType: "draft.checkout.save",
        risk: "low",
        summary: "Save checkout draft",
      },
      async () => {
        let current: PendingDraft | null = null;
        try {
          current = await getPendingDraft(ctx.conversationId!);
        } catch {
          current = null;
        }

        if (current && current.kind !== "checkout") {
          return invalid(
            `A different pending ${current.kind} draft is already active in this conversation. Finish or cancel it before starting a checkout draft.`,
          );
        }

        const merged = {
          ...(current?.fields ?? {}),
          ...sanitizeFields(fields),
        };

        const draft: PendingDraft = {
          kind: "checkout",
          fields: merged,
          expect: expect ?? missingDraftFields("checkout", merged)[0] ?? undefined,
          updatedAt: new Date().toISOString(),
        };

        await setPendingDraft(ctx.conversationId!, draft);
        return ok(draftState(draft));
      },
    );
    return result;
  },
});

/**
 * Abandon the active pending draft in this conversation. Shared by admin
 * (product create/edit) and customer (checkout). Called when the user
 * explicitly abandons the in-progress task ("chhod do" / "cancel it").
 */
export const cancelDraftTool = tool({
  name: "cancel_draft",
  description:
    "Abandon/cancel the active pending draft in this conversation (product create/edit or checkout). Call it when the user explicitly says 'chhod do', 'cancel it', or otherwise clearly drops the current in-progress task. Returns what was cancelled (or cancelled:false if no draft was active). Never call it just because the user paused or asked an unrelated question — the draft must survive interruptions and resume later.",
  parameters: z.object({}),
  strict: true,
  inputGuardrails: [
    toolRoleGuardrail("cancel_draft", [ADMIN_ROLE, CUSTOMER_ROLE]),
  ],
  async execute(_params: object, runContext?: RunContext<AgentContext>) {
    const ctx = runContext?.context;
    if (!ctx) {
      return { ok: false, reason: "error", message: "Missing execution context." } as const;
    }
    if (!ctx.conversationId) {
      return invalid("Drafts are only available inside a saved conversation.");
    }

    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "cancel_draft",
        actionType: "draft.cancel",
        risk: "low",
        summary: "Cancel pending draft",
      },
      async (): Promise<
        ToolResult<{ cancelled: boolean; activeKind: PendingDraftKind | null }>
      > => {
        let current: PendingDraft | null = null;
        try {
          current = await getPendingDraft(ctx.conversationId!);
        } catch {
          current = null;
        }

        if (!current) {
          return ok({ cancelled: false, activeKind: null });
        }

        await setPendingDraft(ctx.conversationId!, null);
        return ok({ cancelled: true, activeKind: current.kind });
      },
    );
    return result;
  },
});