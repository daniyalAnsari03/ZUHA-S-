"use client";

import { useActionState } from "react";
import Link from "next/link";

import {
  createProductAction,
  updateProductAction,
  type ActionResult,
} from "@/app/admin/actions";
import {
  CheckboxField,
  FormError,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/form-fields";

export type CategoryOption = { id: string; name: string };

export type ProductFormValues = {
  name: string;
  slug: string;
  description: string;
  fabric: string;
  embroidery: string;
  color: string;
  label: string;
  categoryId: string;
  price: number | "";
  compareAtPrice: number | "";
  sku: string;
  stockQuantity: number | "";
  lowStockThreshold: number | "";
  imageUrl: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number | "";
};

type ProductFormProps = {
  categories: CategoryOption[];
  defaultValues: ProductFormValues;
  /** Set when editing so the action binds to the existing product. */
  productId?: string;
};

const EMPTY_VALUES: ProductFormValues = {
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
};

export function ProductForm({
  categories,
  defaultValues,
  productId,
}: ProductFormProps) {
  const action = productId
    ? updateProductAction.bind(null, productId)
    : createProductAction;
  const [state, formAction, pending] = useActionState(action, {
    ok: true,
  } satisfies ActionResult);

  const values = { ...EMPTY_VALUES, ...defaultValues };

  return (
    <form action={formAction} className="mt-8 space-y-8">
      <FormError message={state.ok ? undefined : state.error} />

      <section className="rounded-2xl border border-charcoal/10 bg-white p-6">
        <h2 className="font-serif text-lg text-charcoal">Essentials</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <TextField
            label="Name *"
            name="name"
            defaultValue={values.name}
            placeholder="Khirke Jamawar"
            required
          />
          <TextField
            label="Slug *"
            name="slug"
            defaultValue={values.slug}
            placeholder="khirke-jamawar"
            hint="Lowercase letters, numbers and hyphens."
            required
          />
          <SelectField
            label="Category"
            name="categoryId"
            defaultValue={values.categoryId}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          <TextField
            label="Fabric"
            name="fabric"
            defaultValue={values.fabric}
            placeholder="Hand-woven jamawar"
          />
          <TextField
            label="Embroidery"
            name="embroidery"
            defaultValue={values.embroidery}
            placeholder="Woven motif"
          />
          <TextField
            label="Color"
            name="color"
            defaultValue={values.color}
            placeholder="Plum & gold"
          />
          <TextField
            label="Label"
            name="label"
            defaultValue={values.label}
            placeholder="New"
            hint="Small editorial badge, e.g. New or Bestseller."
          />
          <TextField
            label="SKU"
            name="sku"
            defaultValue={values.sku}
            placeholder="DINS-001"
          />
        </div>
        <div className="mt-5">
          <TextAreaField
            label="Description"
            name="description"
            defaultValue={values.description}
            rows={4}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-charcoal/10 bg-white p-6">
        <h2 className="font-serif text-lg text-charcoal">Pricing & stock</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <TextField
            label="Price (PKR) *"
            name="price"
            type="number"
            min="0"
            step="1"
            defaultValue={
              values.price === "" ? undefined : String(values.price)
            }
            required
          />
          <TextField
            label="Compare-at price (PKR)"
            name="compareAtPrice"
            type="number"
            min="0"
            step="1"
            defaultValue={
              values.compareAtPrice === ""
                ? undefined
                : String(values.compareAtPrice)
            }
            hint="A higher original price shown for contrast."
          />
          <TextField
            label="Stock quantity *"
            name="stockQuantity"
            type="number"
            min="0"
            step="1"
            defaultValue={
              values.stockQuantity === "" ? undefined : String(values.stockQuantity)
            }
            required
          />
          <TextField
            label="Low stock threshold"
            name="lowStockThreshold"
            type="number"
            min="0"
            step="1"
            defaultValue={
              values.lowStockThreshold === ""
                ? undefined
                : String(values.lowStockThreshold)
            }
            hint="Highlight when stock drops to this number."
          />
          <TextField
            label="Sort order"
            name="sortOrder"
            type="number"
            min="0"
            step="1"
            defaultValue={
              values.sortOrder === "" ? undefined : String(values.sortOrder)
            }
            hint="Lower numbers appear first."
          />
        </div>
      </section>

      <section className="rounded-2xl border border-charcoal/10 bg-white p-6">
        <h2 className="font-serif text-lg text-charcoal">Media & visibility</h2>
        <div className="mt-5 space-y-5">
          <TextField
            label="Product image URL"
            name="imageUrl"
            defaultValue={values.imageUrl}
            placeholder="/images/placeholders/product-1.svg"
            hint="Absolute path or full URL. Storage upload arrives in a later phase."
          />
          <div className="flex flex-wrap gap-8">
            <CheckboxField
              label="Active"
              name="isActive"
              defaultChecked={values.isActive}
              hint="Visible in the storefront."
            />
            <CheckboxField
              label="Featured"
              name="isFeatured"
              defaultChecked={values.isFeatured}
              hint="Shown in featured collections."
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-plum px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-plum-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : productId ? "Save changes" : "Create product"}
        </button>
        <Link
          href="/admin/products"
          className="rounded-full border border-charcoal/15 px-6 py-2.5 text-sm font-medium text-charcoal-muted transition-colors hover:border-plum/40 hover:text-plum"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}