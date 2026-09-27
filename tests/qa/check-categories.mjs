import { queryRows } from "./lib/harness.mjs";

const cats = await queryRows(
  "categories",
  "",
  "select=id,name,slug&order=sort_order.asc",
);
for (const c of cats ?? []) {
  console.log(`${c.slug}\t${c.name}\t${c.id}`);
}
