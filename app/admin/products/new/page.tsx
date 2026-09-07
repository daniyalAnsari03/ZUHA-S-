import { getAuthUser } from "@/lib/auth/session";
import { listAllCategories } from "@/services/categories/categories-service";
import { ProductForm } from "@/app/admin/components/product-form";

export default async function NewProductPage() {
  const user = await getAuthUser();
  const actor = { id: user!.id, role: user!.role as "admin" };

  const categories = await listAllCategories(actor);

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-3xl text-charcoal">New product</h1>
      <p className="mt-1 text-sm text-charcoal-muted">
        Create a product that can immediately appear on the storefront.
      </p>
      <ProductForm
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        defaultValues={{
          name: "",
          slug: "",
          description: "",
          fabric: "",
          embroidery: "",
          color: "",
          label: "",
          categoryId: "",
          price: "",
          compareAtPrice: "",
          sku: "",
          stockQuantity: "",
          lowStockThreshold: 5,
          imageUrl: "",
          isActive: true,
          isFeatured: false,
          sortOrder: 0,
        }}
      />
    </div>
  );
}