import Link from "next/link";
import { Pencil, Plus } from "lucide-react";

import { getAuthUser } from "@/lib/auth/session";
import { listAllCategories } from "@/services/categories/categories-service";
import { toggleCategoryActiveAction } from "@/app/admin/actions";

export default async function AdminCategoriesPage() {
  const user = await getAuthUser();
  const actor = { id: user!.id, role: user!.role as "admin" };

  const categories = await listAllCategories(actor);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-charcoal">Categories</h1>
          <p className="mt-1 text-sm text-charcoal-muted">
            {categories.length} total ({categories.filter((c) => c.is_active).length} active)
          </p>
        </div>
        <Link
          href="/admin/categories/new"
          className="inline-flex items-center gap-2 rounded-full bg-plum px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-plum-dark"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add category
        </Link>
      </div>

      <div className="mt-8 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[640px] border-collapse overflow-hidden rounded-2xl border border-charcoal/10 bg-white text-left">
          <thead>
            <tr className="border-b border-charcoal/10 text-xs uppercase tracking-wide text-charcoal-muted">
              <th className="px-5 py-3.5 font-semibold">Category</th>
              <th className="px-5 py-3.5 font-semibold">Slug</th>
              <th className="px-5 py-3.5 font-semibold">Sort</th>
              <th className="px-5 py-3.5 font-semibold">Status</th>
              <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal/5">
            {categories.map((category) => (
              <tr key={category.id} className="transition-colors hover:bg-cream/50">
                <td className="px-5 py-3">
                  <Link
                    href={`/admin/categories/${category.id}/edit`}
                    className="text-sm font-medium text-charcoal hover:text-plum"
                  >
                    {category.name}
                  </Link>
                  {category.description ? (
                    <span className="block max-w-xs truncate text-xs text-charcoal-muted">
                      {category.description}
                    </span>
                  ) : null}
                </td>
                <td className="px-5 py-3 text-sm text-charcoal-muted">
                  {category.slug}
                </td>
                <td className="px-5 py-3 text-sm text-charcoal-muted">
                  {category.sort_order}
                </td>
                <td className="px-5 py-3">
                  <form
                    action={toggleCategoryActiveAction.bind(null, category.id, !category.is_active)}
                  >
                    <button
                      type="submit"
                      className={
                        category.is_active
                          ? "rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-200"
                          : "rounded-full bg-charcoal/10 px-2.5 py-1 text-xs font-medium text-charcoal-muted transition-colors hover:bg-charcoal/15"
                      }
                    >
                      {category.is_active ? "Active" : "Inactive"}
                    </button>
                  </form>
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/admin/categories/${category.id}/edit`}
                    aria-label={`Edit ${category.name}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-charcoal-muted transition-colors hover:bg-plum/10 hover:text-plum"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}