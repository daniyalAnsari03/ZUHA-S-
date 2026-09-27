import { describe, expect, it } from "vitest";

import {
  extractProductsFromToolOutput,
  extractTextDelta,
} from "@/lib/ai/stream";

/**
 * Streaming delta extraction tests.
 *
 * The Responses API (openai ^7) streams text tokens as raw model events with
 * `type: "response.output_text.delta"` and the token under `delta`. The
 * adapter must accept this shape (plus legacy variants) so the chat UI can
 * render text progressively instead of waiting for the full response.
 */
describe("extractTextDelta", () => {
  it("extracts text from response.output_text.delta (openai ^7)", () => {
    expect(
      extractTextDelta({ type: "response.output_text.delta", delta: "Hello " }),
    ).toBe("Hello ");
  });

  it("extracts text from the legacy output_text_delta shape", () => {
    expect(
      extractTextDelta({ type: "output_text_delta", delta: "world" }),
    ).toBe("world");
  });

  it("extracts text from the output_text.delta shape", () => {
    expect(extractTextDelta({ type: "output_text.delta", delta: "!" })).toBe(
      "!",
    );
  });

  it("returns undefined when delta is not a string", () => {
    expect(
      extractTextDelta({ type: "response.output_text.delta", delta: 42 }),
    ).toBeUndefined();
    expect(
      extractTextDelta({ type: "response.output_text.delta" }),
    ).toBeUndefined();
  });

  it("ignores non-text raw events", () => {
    expect(
      extractTextDelta({ type: "response.reasoning_summary_part.added" }),
    ).toBeUndefined();
    expect(
      extractTextDelta({ type: "response.file_search_call.in_progress" }),
    ).toBeUndefined();
    expect(extractTextDelta(null)).toBeUndefined();
    expect(extractTextDelta("text")).toBeUndefined();
    expect(extractTextDelta(42)).toBeUndefined();
  });
});

describe("extractProductsFromToolOutput", () => {
  it("extracts real product rows from a list_products result", () => {
    const output = {
      ok: true,
      data: [
        {
          name: "Jamawar Kurta",
          slug: "jamawar-kurta",
          id: "p1",
          category: "Jamawar",
          price: "PKR 12,500",
          fabric: "Jamawar",
          embroidery: null,
          color: null,
          availability: "In stock (5 available)",
          imageUrl: "products/jamawar-kurta.jpeg",
        },
        {
          name: "Embroidered Lawn",
          slug: "embroidered-lawn",
          id: "p2",
          category: "Lawn",
          price: "PKR 8,900",
          fabric: "Lawn",
          availability: "In stock (12 available)",
          imageUrl: "products/embroidered-lawn.jpeg",
        },
      ],
      totalCount: 2,
      truncated: false,
    };

    const refs = extractProductsFromToolOutput("list_products", output);
    expect(refs).toHaveLength(2);
    expect(refs[0]).toMatchObject({
      name: "Jamawar Kurta",
      slug: "jamawar-kurta",
      price: "PKR 12,500",
      imageUrl: "products/jamawar-kurta.jpeg",
      fabric: "Jamawar",
      category: "Jamawar",
    });
  });

  it("extracts a single product from a get_product result", () => {
    const output = {
      ok: true,
      data: {
        name: "Cut-Dana Special",
        slug: "cut-dana-special",
        id: "p9",
        category: "Cut-Dana Embroidery",
        price: "PKR 18,750",
        fabric: "Silk",
        availability: "Low stock — only 2 left",
        imageUrl: "products/cut-dana-special.jpeg",
        description: "Hand-finished cut-dana work.",
      },
    };

    const refs = extractProductsFromToolOutput("get_product", output);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      name: "Cut-Dana Special",
      price: "PKR 18,750",
      availability: "Low stock — only 2 left",
    });
  });

  it("parses a JSON-stringified tool output defensively", () => {
    const output = JSON.stringify({
      ok: true,
      data: [
        { name: "Plain Lawn", slug: "plain-lawn", id: "a1", price: 4500 },
      ],
    });
    const refs = extractProductsFromToolOutput("list_products", output);
    expect(refs).toHaveLength(1);
    expect(refs[0].price).toBe("PKR 4,500");
  });

  it("returns an empty array for non-catalog tools", () => {
    expect(
      extractProductsFromToolOutput("create_product", {
        ok: true,
        data: { name: "X", slug: "x", id: "z", price: 100 },
      }),
    ).toEqual([]);
    expect(extractProductsFromToolOutput("get_order_detail", null)).toEqual([]);
  });

  it("filters rows without product identity and tolerates garbage", () => {
    const refs = extractProductsFromToolOutput("list_products", {
      ok: true,
      data: [{ foo: "bar" }, { name: "Valid", slug: "valid", id: "ok" }, null],
    });
    expect(refs).toHaveLength(1);
    expect(refs[0].name).toBe("Valid");

    expect(extractProductsFromToolOutput("list_products", "not-json")).toEqual(
      [],
    );
    expect(extractProductsFromToolOutput("list_products", null)).toEqual([]);
  });
});
