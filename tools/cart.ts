import { tool, type RunContext } from "@openai/agents";
import { z } from "zod";

import type { AgentContext } from "@/agents/context";
import {
  toolRoleGuardrail,
  CUSTOMER_ROLE,
} from "@/guardians/authorization";
import {
  addToCart,
  getActiveCart,
  getCartSummaryIfExists,
  removeCartItem,
  updateCartItem,
} from "@/services/cart/cart-service";
import { initiateCheckout } from "@/services/checkout/checkout-service";
import { withToolAudit } from "@/tools/shared/audit";
import { asResult, denied, invalid, notFound } from "@/tools/shared/result";

function presentCart(summary: { itemCount: number; subtotal: number; items: Array<{ id: string; productId: string; name: string; quantity: number; subtotal: number }> } | null) {
  if (!summary || summary.items.length === 0) {
    return { itemCount: 0, subtotalPKR: 0, items: [] };
  }
  return {
    itemCount: summary.itemCount,
    subtotalPKR: Math.round(summary.subtotal),
    items: summary.items.map((item) => ({
      itemId: item.id,
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      lineSubtotalPKR: Math.round(item.subtotal),
    })),
  };
}

/**
 * Cart and checkout tools for the Customer AI. These wrap the existing
 * Phase 4/5 services so the AI uses the exact same validated paths as the
 * storefront UI — server-side pricing, stock checks and one-time confirmation.
 */

export const addToCartTool = tool({
  name: "add_to_cart",
  description:
    "Add a product to the signed-in customer's own cart using its product id. Quantity defaults to 1. Stock and pricing are validated live; returns the updated cart. This is a routine action — no confirmation is needed.",
  parameters: z.object({
    productId: z.string().uuid("A valid product id is required."),
    quantity: z
      .number()
      .int()
      .min(1, "Quantity must be at least 1.")
      .max(1000, "Quantity is unreasonably large.")
      .optional(),
  }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("add_to_cart", [CUSTOMER_ROLE])],
  async execute(
    { productId, quantity }: { productId: string; quantity?: number },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;
    if (!ctx.userId) {
      return denied("You need to be signed in to add items to your cart.");
    }
    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "add_to_cart",
        actionType: "cart.add",
        risk: "medium",
        entityType: "product",
        entityId: productId,
        summary: `Add to cart (qty ${quantity ?? 1})`,
      },
      async () =>
        asResult(() => addToCart(ctx.userId!, { productId, quantity: quantity ?? 1 })),
    );
    if (!result.ok) return result;
    return { ok: true, data: presentCart(result.data) };
  },
});

export const getMyCartTool = tool({
  name: "get_my_cart",
  description:
    "Show the signed-in customer's own current cart with live item prices, quantities and the total. Each item includes its itemId and productId — use productId with add_to_cart, update_cart_quantity or remove_from_cart. Use this to confirm what is in the bag and the amount due before placing an order.",
  parameters: z.object({}),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("get_my_cart", [CUSTOMER_ROLE])],
  async execute(_params: object, runContext?: RunContext<AgentContext>) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;
    if (!ctx.userId) {
      return denied("You need to be signed in to see your cart.");
    }
    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "get_my_cart",
        actionType: "cart.read",
        risk: "low",
        summary: "Read own cart",
      },
      async () => asResult(() => getCartSummaryIfExists(ctx.userId!)),
    );
    if (!result.ok) return result;
    return { ok: true, data: presentCart(result.data) };
  },
});

export const updateCartQuantityTool = tool({
  name: "update_cart_quantity",
  description:
    "Change the quantity of an item already in the signed-in customer's own cart, by its product id (the same id used by add_to_cart, also shown in get_my_cart). Stock is re-validated live. Returns the updated cart. Routine action — no confirmation is needed. If the item is not in the cart, use add_to_cart instead.",
  parameters: z.object({
    productId: z.string().uuid("A valid product id is required."),
    quantity: z
      .number()
      .int("Quantity must be a whole number.")
      .min(1, "Quantity must be at least 1.")
      .max(1000, "Quantity is unreasonably large."),
  }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("update_cart_quantity", [CUSTOMER_ROLE])],
  async execute(
    { productId, quantity }: { productId: string; quantity: number },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;
    if (!ctx.userId) {
      return denied("You need to be signed in to update your cart.");
    }
    const cart = await getActiveCart(ctx.userId);
    const item = cart.items.find((i) => i.product_id === productId);
    if (!item) {
      return notFound("That item is not in your cart. Check your cart with get_my_cart first.");
    }
    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "update_cart_quantity",
        actionType: "cart.update",
        risk: "medium",
        entityType: "product",
        entityId: productId,
        summary: `Update cart quantity to ${quantity}`,
      },
      async () =>
        asResult(() => updateCartItem(ctx.userId!, { itemId: item.id, quantity })),
    );
    if (!result.ok) return result;
    return { ok: true, data: presentCart(result.data) };
  },
});

export const removeFromCartTool = tool({
  name: "remove_from_cart",
  description:
    "Remove an item from the signed-in customer's own cart by product id (the same id used by add_to_cart, also shown in get_my_cart). Returns the updated cart. Routine action — no confirmation is needed.",
  parameters: z.object({
    productId: z.string().uuid("A valid product id is required."),
  }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("remove_from_cart", [CUSTOMER_ROLE])],
  async execute(
    { productId }: { productId: string },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;
    if (!ctx.userId) {
      return denied("You need to be signed in to update your cart.");
    }
    const cart = await getActiveCart(ctx.userId);
    const item = cart.items.find((i) => i.product_id === productId);
    if (!item) {
      return notFound("That item is not in your cart. Check your cart with get_my_cart first.");
    }
    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "remove_from_cart",
        actionType: "cart.remove",
        risk: "medium",
        entityType: "product",
        entityId: productId,
        summary: "Remove item from cart",
      },
      async () => asResult(() => removeCartItem(ctx.userId!, { itemId: item.id })),
    );
    if (!result.ok) return result;
    return { ok: true, data: presentCart(result.data) };
  },
});

export const placeCodOrderTool = tool({
  name: "place_cod_order",
  description:
    "Place a Cash-on-Delivery order for the signed-in customer's current cart. Requires the customer's full name, Pakistani mobile number (e.g. 03001234567), email, shipping address and city. Prices, stock and the total are computed and re-validated server-side; stock is deducted and the order is created on confirmation. IMPORTANT: only set confirm=true AFTER the customer has explicitly confirmed the order in chat. If confirm is false, no order is created.",
  parameters: z.object({
    name: z.string().trim().min(1, "Full name is required.").max(120),
    phone: z
      .string()
      .trim()
      .min(1, "Phone number is required.")
      .regex(
        /^(\+?92|0)?3\d{9}$/,
        "Enter a valid Pakistani mobile number (e.g. 03001234567).",
      ),
    email: z.string().trim().min(1, "Email is required.").email("Enter a valid email."),
    shippingAddress: z.string().trim().min(1, "Shipping address is required.").max(300),
    city: z.string().trim().min(1, "City is required.").max(80),
    postalCode: z.string().trim().max(20).optional(),
    orderNotes: z.string().trim().max(1000).optional(),
    confirm: z.boolean(),
  }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("place_cod_order", [CUSTOMER_ROLE])],
  async execute(
    {
      name,
      phone,
      email,
      shippingAddress,
      city,
      postalCode,
      orderNotes,
      confirm,
    }: {
      name: string;
      phone: string;
      email: string;
      shippingAddress: string;
      city: string;
      postalCode?: string;
      orderNotes?: string;
      confirm: boolean;
    },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;
    if (!ctx.userId) {
      return denied("You need to be signed in to place an order.");
    }
    if (confirm !== true) {
      return invalid(
        "The order has not been placed. Show the confirmed total and shipping details, then ask the customer for ONE explicit confirmation, and call this tool again with confirm=true after they confirm.",
      );
    }

    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "place_cod_order",
        actionType: "order.create",
        risk: "medium",
        summary: "Place COD order from cart",
      },
      async () => {
        const handoff = await initiateCheckout(ctx.userId!, {
          name,
          phone,
          email,
          shippingAddress,
          city,
          postalCode,
          orderNotes,
        });
        if (handoff.state === "success" || handoff.state === "pending") {
          return {
            ok: true as const,
            data: {
              orderId: handoff.orderId,
              orderNumber: handoff.reference,
              provider: handoff.provider,
              message: handoff.message,
            },
          };
        }
        if (handoff.state === "unavailable") {
          return {
            ok: false as const,
            reason: "error" as const,
            message: handoff.message,
          };
        }
        return {
          ok: false as const,
          reason: "invalid" as const,
          message: handoff.errors.join(" "),
        };
      },
    );
    return result;
  },
});