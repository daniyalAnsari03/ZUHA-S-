// Read-only: Mehrab Jamawar current stock (for pre/post restoration check).
import { getFirst } from "./lib/harness.mjs";
const row = await getFirst("products", "slug=eq.mehrab-jamawar");
console.log(
  JSON.stringify(
    row
      ? {
          id: row.id,
          name: row.name,
          stock_quantity: row.stock_quantity,
          category_id: row.category_id,
        }
      : null,
  ),
);
