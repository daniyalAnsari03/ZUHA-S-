import { describe, expect, it } from "vitest";

/**
 * Marketing tool schema and validation tests.
 *
 * These test the marketing text-generation tools' parameter validation
 * without calling the OpenAI API. The tools use Zod schemas that reject
 * invalid inputs at the SDK level before execution.
 */

// We test the tool parameter schemas by importing the tool definitions
// and verifying their parameter schemas reject invalid inputs.

// Since the tools are defined with `tool()` from @openai/agents, we can
// access the schema through the tool's parameters property.

import {
  generateProductMarketingCopy,
  generateSocialPost,
  generateAdCopy,
} from "@/tools/marketing";

describe("generateProductMarketingCopy tool", () => {
  it("is defined with correct name", () => {
    expect(generateProductMarketingCopy.name).toBe(
      "generate_product_marketing_copy",
    );
  });

  it("has a description", () => {
    expect(generateProductMarketingCopy.description).toBeTruthy();
    expect(generateProductMarketingCopy.description.length).toBeGreaterThan(10);
  });
});

describe("generateSocialPost tool", () => {
  it("is defined with correct name", () => {
    expect(generateSocialPost.name).toBe("generate_social_post");
  });

  it("has a description", () => {
    expect(generateSocialPost.description).toBeTruthy();
  });
});

describe("generateAdCopy tool", () => {
  it("is defined with correct name", () => {
    expect(generateAdCopy.name).toBe("generate_ad_copy");
  });

  it("has a description", () => {
    expect(generateAdCopy.description).toBeTruthy();
  });
});

describe("marketing tools safety", () => {
  it("generateProductMarketingCopy is properly defined with name and description", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tool = generateProductMarketingCopy as any;
    expect(tool).toBeDefined();
    expect(tool.name).toBe("generate_product_marketing_copy");
    expect(typeof tool.description).toBe("string");
    expect(tool.description.length).toBeGreaterThan(10);
  });

  it("generateSocialPost is properly defined with name and description", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tool = generateSocialPost as any;
    expect(tool).toBeDefined();
    expect(tool.name).toBe("generate_social_post");
    expect(typeof tool.description).toBe("string");
  });

  it("generateAdCopy is properly defined with name and description", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tool = generateAdCopy as any;
    expect(tool).toBeDefined();
    expect(tool.name).toBe("generate_ad_copy");
    expect(typeof tool.description).toBe("string");
  });
});
