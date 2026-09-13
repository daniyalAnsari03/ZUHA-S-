import { tool, type RunContext } from "@openai/agents";
import { z } from "zod";
import OpenAI from "openai";

import type { AgentContext } from "@/agents/context";
import { withToolAudit } from "@/tools/shared/audit";
import { asResult, normalizeString } from "@/tools/shared/result";

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  return new OpenAI({ apiKey });
}

const MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-5.6-luna";

async function generateText(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_completion_tokens: 800,
  });
  return response.choices[0]?.message?.content ?? "";
}

const MARKETING_SYSTEM = `You are the marketing copywriter for dINS by Daniyal, a premium Pakistani fashion label. 
You write elegant, aspirational copy that reflects luxury craftsmanship. 
Prices are in PKR. Never fabricate product details — only use what the user provides.
Be concise and impactful. Output only the requested copy, no meta-commentary.`;

export const generateProductMarketingCopy = tool({
  name: "generate_product_marketing_copy",
  description:
    "Generate premium marketing copy for a product. Provide the product name, category, fabric, embroidery, price and any key details. Returns a headline and short description suitable for product pages or promotions.",
  parameters: z.object({
    productName: z.string().min(1).max(160),
    category: z.string().min(1).max(80),
    fabric: z.string().optional(),
    embroidery: z.string().optional(),
    price: z.number().min(0),
    color: z.string().optional(),
    keyDetails: z.string().max(500).optional(),
  }),
  strict: true,
  async execute(
    params: {
      productName: string;
      category: string;
      fabric?: string;
      embroidery?: string;
      price: number;
      color?: string;
      keyDetails?: string;
    },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;

    const productName = normalizeString(params.productName);
    const category = normalizeString(params.category);
    if (!productName || !category) {
      return {
        ok: false,
        reason: "invalid",
        message: "Product name and category are required for generating marketing copy.",
      };
    }

    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "generate_product_marketing_copy",
        actionType: "marketing.copy.generate",
        risk: "low",
        entityType: "product",
        summary: `Generate marketing copy for "${productName}"`,
      },
      async () => {
        const userPrompt = [
          `Product: ${productName}`,
          `Category: ${category}`,
          params.fabric ? `Fabric: ${params.fabric}` : null,
          params.embroidery ? `Embroidery: ${params.embroidery}` : null,
          `Price: PKR ${params.price.toLocaleString("en-PK")}`,
          params.color ? `Color: ${params.color}` : null,
          params.keyDetails ? `Additional details: ${params.keyDetails}` : null,
        ]
          .filter(Boolean)
          .join("\n");

        const text = await generateText(MARKETING_SYSTEM, userPrompt);
        return asResult(async () => ({
          headline: productName,
          copy: text.trim(),
        }));
      },
    );
    if (!result.ok) return result;
    return { ok: true, data: result.data };
  },
});

export const generateSocialPost = tool({
  name: "generate_social_post",
  description:
    "Generate a social media post (Instagram/Facebook) for a product or promotion. Returns caption, hashtags and a suggested tone.",
  parameters: z.object({
    productName: z.string().optional(),
    category: z.string().optional(),
    promotion: z.string().max(200).optional(),
    tone: z.enum(["elegant", "casual", "luxurious", "festive"]).default("elegant"),
    platform: z.enum(["instagram", "facebook", "both"]).default("both"),
  }),
  strict: true,
  async execute(
    params: {
      productName?: string;
      category?: string;
      promotion?: string;
      tone: string;
      platform: string;
    },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;
    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "generate_social_post",
        actionType: "marketing.social.generate",
        risk: "low",
        summary: `Generate ${params.platform} social post`,
      },
      async () => {
        const parts: string[] = [];
        if (params.productName) parts.push(`Product: ${params.productName}`);
        if (params.category) parts.push(`Category: ${params.category}`);
        if (params.promotion) parts.push(`Promotion: ${params.promotion}`);
        parts.push(`Tone: ${params.tone}`);
        parts.push(`Platform: ${params.platform}`);
        parts.push(
          "Include 5-8 relevant hashtags. Output: Caption followed by hashtags on separate lines.",
        );

        const text = await generateText(MARKETING_SYSTEM, parts.join("\n"));
        return asResult(async () => ({
          post: text.trim(),
          platform: params.platform,
          tone: params.tone,
        }));
      },
    );
    if (!result.ok) return result;
    return { ok: true, data: result.data };
  },
});

export const generateAdCopy = tool({
  name: "generate_ad_copy",
  description:
    "Generate short advertising copy for a product or sale. Returns a headline and body text suitable for paid ads or banner text.",
  parameters: z.object({
    productName: z.string().optional(),
    category: z.string().optional(),
    promotion: z.string().max(200).optional(),
    targetAudience: z.string().max(100).optional(),
    maxLength: z.enum(["short", "medium"]).default("short"),
  }),
  strict: true,
  async execute(
    params: {
      productName?: string;
      category?: string;
      promotion?: string;
      targetAudience?: string;
      maxLength: string;
    },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) return { ok: false, reason: "error", message: "Missing execution context." } as const;
    const result = await withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "generate_ad_copy",
        actionType: "marketing.ad.generate",
        risk: "low",
        summary: `Generate ${params.maxLength} ad copy`,
      },
      async () => {
        const parts: string[] = [];
        if (params.productName) parts.push(`Product: ${params.productName}`);
        if (params.category) parts.push(`Category: ${params.category}`);
        if (params.promotion) parts.push(`Promotion: ${params.promotion}`);
        if (params.targetAudience) parts.push(`Target audience: ${params.targetAudience}`);
        parts.push(
          params.maxLength === "short"
            ? "Output a short headline (max 8 words) and a one-line body."
            : "Output a headline (max 10 words) and a 2-3 sentence body.",
        );

        const text = await generateText(MARKETING_SYSTEM, parts.join("\n"));
        return asResult(async () => ({
          adCopy: text.trim(),
          maxLength: params.maxLength,
        }));
      },
    );
    if (!result.ok) return result;
    return { ok: true, data: result.data };
  },
});
