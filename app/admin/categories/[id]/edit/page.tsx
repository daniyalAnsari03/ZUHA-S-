import { notFound } from "next/navigation";

import { getCategoryById } from "@/services/categories/categories-service";
import {
  CategoryForm,
  type CategoryFormValues,
} from "@/app/admin/components/category-form";

type Props = { params: Promise<{ id: string }> };

function rowToValues(
  row: {
    name: string;
    slug: string;
    description: string | null;
    image_url: string | null;
    is_active: boolean;
    sort_order: number | null;
  },
): CategoryFormValues {
  return {
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    imageUrl: row.image_url ?? "",
    isActive: row.is_active,
    sortOrder: row.sort_order ?? 0,
  };
}

export default async function EditCategoryPage({ params }: Props) {
  const { id } = await params;

  const category = await getCategoryById(id);

  if (!category) notFound();

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-3xl text-charcoal">Edit category</h1>
      <p className="mt-1 text-sm text-charcoal-muted">
        Changes apply to the navigation and shop filters once saved and verified.
      </p>
      <CategoryForm categoryId={id} defaultValues={rowToValues(category)} />
    </div>
  );
}