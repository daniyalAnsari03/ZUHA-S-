"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProfileAction } from "@/app/storefront/actions";

type ProfileData = {
  full_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
};

export function ProfileEditor({
  email,
  role,
  profile,
}: {
  email: string;
  role: string;
  profile: ProfileData;
}) {
  const [form, setForm] = useState({
    full_name: profile.full_name ?? "",
    phone: profile.phone ?? "",
    address: profile.address ?? "",
    city: profile.city ?? "",
    postal_code: profile.postal_code ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const res = await updateProfileAction(form);
    setResult({ ok: res.ok, message: res.ok ? res.message : res.error });
    setLoading(false);
  };

  return (
    <article className="rounded-xl border border-charcoal/10 bg-neutral-soft p-6 sm:p-8">
      <h2 className="font-serif text-lg text-charcoal">Account Information</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-charcoal-muted">
            Email
          </dt>
          <dd className="mt-1 text-sm text-charcoal">{email}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-charcoal-muted">
            Role
          </dt>
          <dd className="mt-1 text-sm capitalize text-charcoal">{role}</dd>
        </div>
      </dl>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <h3 className="text-xs uppercase tracking-[0.28em] text-charcoal-muted">
          Profile Details
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="profile-name"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-muted"
            >
              Full Name
            </label>
            <Input
              id="profile-name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Your full name"
            />
          </div>
          <div>
            <label
              htmlFor="profile-phone"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-muted"
            >
              Phone
            </label>
            <Input
              id="profile-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="0300 1234567"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="profile-address"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-muted"
          >
            Address
          </label>
          <Input
            id="profile-address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Your address"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="profile-city"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-muted"
            >
              City
            </label>
            <Input
              id="profile-city"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="City"
            />
          </div>
          <div>
            <label
              htmlFor="profile-postal"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-muted"
            >
              Postal Code
            </label>
            <Input
              id="profile-postal"
              value={form.postal_code}
              onChange={(e) =>
                setForm({ ...form, postal_code: e.target.value })
              }
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" size="sm" disabled={loading}>
            {loading ? "Saving…" : "Save Changes"}
          </Button>
          {result && (
            <p
              className={`text-sm ${result.ok ? "text-green-700" : "text-red-600"}`}
            >
              {result.message}
            </p>
          )}
        </div>
      </form>
    </article>
  );
}
