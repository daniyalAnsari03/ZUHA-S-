// Read-only: full catalog listing to plan category assignment for NULL-category products.
import { queryRows } from "./lib/harness.mjs";
const all = await queryRows("products", "", "select=id,name,slug,sku,category_id,fabric,embroidery,color,description,price,is_active");
for (const p of Array.isArray(all) ? all : []) {
  console.log(`\n=== ${p.name} (${p.slug})`);
  console.log(`  category_id=${p.category_id} price=${p.price} active=${p.is_active}`);
  console.log(`  fabric=${p.fabric ?? "-"} embroidery=${p.embroidery ?? "-"} color=${p.color ?? "-"}`);
  console.log(`  desc=${(p.description ?? "").slice(0, 140)}`);
}