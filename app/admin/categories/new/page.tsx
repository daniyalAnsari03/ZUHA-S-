import { CategoryForm } from "@/app/admin/components/category-form";

export default async function NewCategoryPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-3xl text-charcoal">New category</h1>
      <p className="mt-1 text-sm text-charcoal-muted">
        Categories drive the navigation, shop filters and homepage sections.
      </p>
      <CategoryForm
        defaultValues={{
          name: "",
          slug: "",
          description: "",
          imageUrl: "",
          isActive: true,
          sortOrder: 0,
        }}
      />
    </div>
  );
}
