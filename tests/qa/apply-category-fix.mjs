import { servicePatch, getFirst, queryRows } from "./lib/harness.mjs";

const mappings = [
  ["khirke-jamawar", "jamawar"],
  ["sukoon-cotton", "plain"],
  ["rihla-cotton", "plain"],
  ["naseem-plain-kurta", "plain"],
  ["hira-unstitched", "unstitched"],
];

let allOk = true;
for (const [slug, catSlug] of mappings) {
  const cat = await getFirst("categories", `slug=eq.${catSlug}`);
  if (!cat) {
    console.log(`MISSING CATEGORY ${catSlug} for ${slug}`);
    allOk = false;
    continue;
  }
  const row = await getFirst("products", `slug=eq.${slug}`);
  if (row?.category_id === cat.id) {
    console.log(`${slug} -> ${catSlug} already set (${cat.id})`);
    continue;
  }
  await servicePatch(`/rest/v1/products?slug=eq.${slug}`, {
    category_id: cat.id,
  });
  const after = await getFirst("products", `slug=eq.${slug}`);
  const ok = after?.category_id === cat.id;
  if (!ok) allOk = false;
  console.log(
    `${slug} -> ${catSlug} ${ok ? "OK" : "FAILED"} category_id=${after?.category_id}`,
  );
}

const nulls = await queryRows(
  "products",
  "category_id=is.null",
  "select=name,slug,sku",
);
console.log("Remaining NULL-category products:", JSON.stringify(nulls ?? []));
process.exit(allOk && (!nulls || nulls.length === 0) ? 0 : 1);
