"use client";

import { useActionState } from "react";
import Link from "next/link";

import {
  createCategoryAction,
  updateCategoryAction,
  type ActionResult,
} from "@/app/admin/actions";
import { ImagePicker } from "@/components/admin/image-picker";
import {
  CheckboxField,
  FormError,
  TextAreaField,
  TextField,
} from "@/components/ui/form-fields";

export type CategoryFormValues = {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number | "";
};

type CategoryFormProps = {
  defaultValues: CategoryFormValues;
  /** Set when editing so the action binds to the existing category. */
  categoryId?: string;
};

const EMPTY_VALUES: CategoryFormValues = {
  name: "",
  slug: "",
  description: "",
  imageUrl: "",
  isActive: true,
  sortOrder: 0,
};

export function CategoryForm({
  defaultValues,
  categoryId,
}: CategoryFormProps) {
  const action = categoryId
    ? updateCategoryAction.bind(null, categoryId)
    : createCategoryAction;
  const [state, formAction, pending] = useActionState(action, {
    ok: true,
  } satisfies ActionResult);

  const values = { ...EMPTY_VALUES, ...defaultValues };

  return (
    <form action={formAction} className="mt-8 space-y-8">
      <FormError message={state.ok ? undefined : state.error} />

      <section className="rounded-2xl border border-charcoal/10 bg-white p-6">
        <h2 className="font-serif text-lg text-charcoal">Category details</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <TextField
            label="Name *"
            name="name"
            defaultValue={values.name}
            placeholder="Jamawar"
            required
          />
          <TextField
            label="Slug *"
            name="slug"
            defaultValue={values.slug}
            placeholder="jamawar"
            hint="Lowercase letters, numbers and hyphens."
            required
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
        <div className="mt-5">
          <ImagePicker
            name="imageUrl"
            value={values.imageUrl}
            folder="categories"
            label="Category Image"
            hint="Select or upload a category image."
          />
        </div>
        <div className="mt-5">
          <TextAreaField
            label="Description"
            name="description"
            defaultValue={values.description}
            rows={3}
          />
        </div>
        <div className="mt-5">
          <CheckboxField
            label="Active"
            name="isActive"
            defaultChecked={values.isActive}
            hint="Visible in the storefront menu and shop filters."
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-plum px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-plum-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : categoryId ? "Save changes" : "Create category"}
        </button>
        <Link
          href="/admin/categories"
          className="rounded-full border border-charcoal/15 px-6 py-2.5 text-sm font-medium text-charcoal-muted transition-colors hover:border-plum/40 hover:text-plum"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}