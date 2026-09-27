import { notFound, redirect } from "next/navigation";

import { deleteProductAction } from "@/app/admin/actions";
import { ConfirmDelete } from "@/app/admin/components/confirm-delete";
import { getAuthUser } from "@/lib/auth/session";
import type { Database } from "@/lib/supabase/types";
import { listAllCategories } from "@/services/categories/categories-service";
import { getProductById } from "@/services/products/products-service";
import {
  ProductForm,
  type ProductFormValues,
} from "@/app/admin/components/product-form";

type Props = { params: Promise<{ id: string }> };

function rowToValues(
  row: Database["public"]["Tables"]["products"]["Row"],
): ProductFormValues {
  return {
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    fabric: row.fabric ?? "",
    embroidery: row.embroidery ?? "",
    color: row.color ?? "",
    label: row.label ?? "",
    categoryId: row.category_id ?? "",
    price: row.price,
    compareAtPrice: row.compare_at_price ?? "",
    sku: row.sku ?? "",
    stockQuantity: row.stock_quantity,
    lowStockThreshold: row.low_stock_threshold,
    imageUrl: row.image_url ?? "",
    isActive: row.is_active,
    isFeatured: row.is_featured,
    sortOrder: row.sort_order ?? 0,
  };
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/login");
  const actor = { id: user.id, role: user.role as "admin" };

  const [product, categories] = await Promise.all([
    getProductById(id),
    listAllCategories(actor),
  ]);

  if (!product) notFound();

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-3xl text-charcoal">Edit product</h1>
      <p className="mt-1 text-sm text-charcoal-muted">
        {product.name} — updates are verified against the database before the
        storefront refreshes.
      </p>
      <ProductForm
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        defaultValues={rowToValues(product)}
        productId={product.id}
      />

      <section className="mt-10 rounded-2xl border border-red-200 bg-red-50/40 p-6">
        <h2 className="font-serif text-lg text-red-800">Danger zone</h2>
        <p className="mt-1 text-sm text-red-700/80">
          Deleting a product keeps its order history intact (order line items
          keep the product name and snapshot price) but removes it from the
          catalog permanently. This cannot be undone.
        </p>
        <div className="mt-4">
          <ConfirmDelete
            title="Delete this product?"
            description={`"${product.name}" will be permanently removed from the catalog. Order history is preserved.`}
            confirmLabel="Delete product"
            action={deleteProductAction.bind(null, product.id)}
            redirectTo="/admin/products"
            className="rounded-lg border border-red-200 bg-ivory px-4 py-2 text-red-700 hover:border-red-400 hover:bg-red-50"
          />
        </div>
      </section>
    </div>
  );
}
