"use client";

import { useRouter } from "next/navigation";

type CategoryFilterProps = {
  categories: { id: string; name: string }[];
  value: string;
  search?: string;
  status?: string;
};

export function CategoryFilterSelect({
  categories,
  value,
  search,
  status,
}: CategoryFilterProps) {
  const router = useRouter();

  return (
    <select
      aria-label="Filter by category"
      value={value}
      onChange={(e) => {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (search) params.set("search", search);
        if (e.target.value) params.set("category", e.target.value);
        const qs = params.toString();
        router.push(qs ? `/admin/inventory?${qs}` : "/admin/inventory");
      }}
      className="ml-auto rounded-lg border border-charcoal/15 bg-white px-3 py-1.5 text-xs font-medium text-charcoal focus:border-plum focus:outline-none"
    >
      <option value="">All categories</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}