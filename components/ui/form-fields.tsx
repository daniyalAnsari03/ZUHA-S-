import type { ReactNode } from "react";

/**
 * Small presentational form primitives shared by admin forms. Styled to match
 * the premium storefront design language (ivory background, plum accents).
 */

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-muted";
const controlClass =
  "w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none transition-colors placeholder:text-charcoal-muted/50 focus:border-plum focus:ring-2 focus:ring-plum/10 disabled:cursor-not-allowed disabled:opacity-60";

type FieldBaseProps = {
  label: string;
  hint?: string;
};

export function TextField({
  label,
  hint,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required,
  min,
  step,
}: FieldBaseProps & {
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
  step?: string;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        min={min}
        step={step}
        className={controlClass}
      />
      {hint ? (
        <span className="mt-1 block text-xs text-charcoal-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function TextAreaField({
  label,
  hint,
  name,
  defaultValue,
  rows = 4,
}: FieldBaseProps & {
  name: string;
  defaultValue?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        className={controlClass}
      />
      {hint ? (
        <span className="mt-1 block text-xs text-charcoal-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function SelectField({
  label,
  hint,
  name,
  defaultValue,
  options,
}: FieldBaseProps & {
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className={controlClass}
      >
        <option value="">None</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? (
        <span className="mt-1 block text-xs text-charcoal-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function CheckboxField({
  label,
  hint,
  name,
  defaultChecked,
}: FieldBaseProps & {
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    // `min-h-11` makes the whole row (not just the 16px checkbox) a 44px touch
    // target, and `has-[:focus-visible]` gives the label the focus ring the
    // checkbox cannot show for itself.
    <label className="flex min-h-11 cursor-pointer items-start gap-2.5 py-1.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-plum">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-charcoal/20 accent-plum"
      />
      <span className="text-sm text-charcoal">
        {label}
        {hint ? (
          <span className="block text-xs text-charcoal-muted">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}

export function FormError({ message }: { message?: ReactNode }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
    >
      {message}
    </p>
  );
}
