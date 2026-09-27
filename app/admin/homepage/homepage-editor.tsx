"use client";

import { useActionState, useState } from "react";
import {
  saveCmsHeroAction,
  saveCmsHomepageAction,
  type ActionResult,
} from "@/app/admin/actions";
import { ImagePicker } from "@/components/admin/image-picker";

type HeroData = {
  id: string;
  image: string;
  eyebrow: string;
  heading: string;
  paragraph: string;
  ctaLabel: string;
  ctaHref: string;
  active: boolean;
  order: number;
};

type HomepageData = {
  shopByCategoryHeading: string;
  shopByCategoryEyebrow: string;
  brandStoryHeading: string;
  brandStoryBody: string;
  brandStoryCta: string;
  brandStoryImage: string;
  socialHeading: string;
  socialEyebrow: string;
  socialDescription: string;
  socialHandle: string;
  socialImages: string[];
  newsletterHeading: string;
  newsletterEyebrow: string;
  newsletterDescription: string;
  newsletterCtaLabel: string;
  footerAbout: string;
  footerCopyright: string;
  footerTagline: string;
};

type HomepageEditorProps = {
  hero: HeroData;
  homepage: HomepageData;
};

export function HomepageEditor({ hero, homepage }: HomepageEditorProps) {
  const [heroState, heroFormAction, heroPending] = useActionState(
    saveCmsHeroAction,
    { ok: true } satisfies ActionResult,
  );
  const [homeState, homeFormAction, homePending] = useActionState(
    saveCmsHomepageAction,
    { ok: true } satisfies ActionResult,
  );

  const [heroData, setHeroData] = useState<HeroData>(hero);
  const [homeData, setHomeData] = useState<HomepageData>(homepage);

  const updateHero = (
    field: keyof HeroData,
    value: string | boolean | number,
  ) => {
    setHeroData((prev) => ({ ...prev, [field]: value }));
  };

  const updateHome = (field: keyof HomepageData, value: string) => {
    setHomeData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="rounded-2xl border border-charcoal/10 bg-neutral-soft p-6">
        <h2 className="font-serif text-lg text-charcoal">Hero Section</h2>
        <p className="mt-1 text-sm text-charcoal-muted">
          Controls the main hero banner on the homepage.
        </p>

        <form
          action={async (formData: FormData) => {
            formData.set("data", JSON.stringify(heroData));
            heroFormAction(formData);
          }}
          className="mt-5 space-y-5"
        >
          {heroState.ok === false && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {heroState.error}
            </p>
          )}
          {heroState.ok === true && heroState.message && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              {heroState.message}
            </p>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
                Eyebrow
              </span>
              <input
                type="text"
                value={heroData.eyebrow}
                onChange={(e) => updateHero("eyebrow", e.target.value)}
                className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                placeholder="Jamawar · Embroidery · Lawn"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
                CTA Link
              </span>
              <input
                type="text"
                value={heroData.ctaHref}
                onChange={(e) => updateHero("ctaHref", e.target.value)}
                className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                placeholder="/shop"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
              Heading *
            </span>
            <input
              type="text"
              value={heroData.heading}
              onChange={(e) => updateHero("heading", e.target.value)}
              className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
              placeholder="Where Pakistani craftsmanship meets modern elegance."
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
              Description
            </span>
            <textarea
              value={heroData.paragraph}
              onChange={(e) => updateHero("paragraph", e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
              placeholder="Hand-finished embroidery, heritage jamawar..."
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
                CTA Label
              </span>
              <input
                type="text"
                value={heroData.ctaLabel}
                onChange={(e) => updateHero("ctaLabel", e.target.value)}
                className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                placeholder="Shop the Collection"
              />
            </label>

            <div className="flex items-end gap-4">
              <label className="flex min-h-11 items-center gap-2 py-1.5">
                <input
                  type="checkbox"
                  checked={heroData.active}
                  onChange={(e) => updateHero("active", e.target.checked)}
                  className="h-4 w-4 rounded border-charcoal/20 accent-plum"
                />
                <span className="text-sm text-charcoal">Active</span>
              </label>
            </div>
          </div>

          <ImagePicker
            name="heroImage"
            value={heroData.image}
            folder="cms/hero"
            label="Hero Image"
            hint="Main hero banner image."
            onChange={(path) => updateHero("image", path)}
          />

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={heroPending}
              className="rounded-full bg-plum px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-plum-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {heroPending ? "Saving..." : "Save Hero"}
            </button>
          </div>
        </form>
      </section>

      {/* Homepage Content */}
      <section className="rounded-2xl border border-charcoal/10 bg-neutral-soft p-6">
        <h2 className="font-serif text-lg text-charcoal">Homepage Content</h2>
        <p className="mt-1 text-sm text-charcoal-muted">
          Edit headings, brand story, social section, newsletter, and footer
          text.
        </p>

        <form
          action={async (formData: FormData) => {
            formData.set("data", JSON.stringify(homeData));
            homeFormAction(formData);
          }}
          className="mt-5 space-y-6"
        >
          {homeState.ok === false && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {homeState.error}
            </p>
          )}
          {homeState.ok === true && homeState.message && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              {homeState.message}
            </p>
          )}

          {/* Shop By Category */}
          <div className="rounded-xl border border-charcoal/10 bg-ivory/50 p-4">
            <h3 className="text-sm font-semibold text-charcoal">
              Shop By Category
            </h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-charcoal-muted">
                  Section Eyebrow
                </span>
                <input
                  type="text"
                  value={homeData.shopByCategoryEyebrow}
                  onChange={(e) =>
                    updateHome("shopByCategoryEyebrow", e.target.value)
                  }
                  className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-charcoal-muted">
                  Section Heading
                </span>
                <input
                  type="text"
                  value={homeData.shopByCategoryHeading}
                  onChange={(e) =>
                    updateHome("shopByCategoryHeading", e.target.value)
                  }
                  className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                />
              </label>
            </div>
          </div>

          {/* Brand Story */}
          <div className="rounded-xl border border-charcoal/10 bg-ivory/50 p-4">
            <h3 className="text-sm font-semibold text-charcoal">Brand Story</h3>
            <div className="mt-3 space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-charcoal-muted">
                  Heading
                </span>
                <input
                  type="text"
                  value={homeData.brandStoryHeading}
                  onChange={(e) =>
                    updateHome("brandStoryHeading", e.target.value)
                  }
                  className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-charcoal-muted">
                  Body Text
                </span>
                <textarea
                  value={homeData.brandStoryBody}
                  onChange={(e) => updateHome("brandStoryBody", e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-charcoal-muted">
                  Tagline
                </span>
                <input
                  type="text"
                  value={homeData.brandStoryCta}
                  onChange={(e) => updateHome("brandStoryCta", e.target.value)}
                  className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                />
              </label>
              <ImagePicker
                name="brandStoryImage"
                value={homeData.brandStoryImage}
                folder="cms/brand-story"
                label="Brand Story Image"
                onChange={(path) => updateHome("brandStoryImage", path)}
              />
            </div>
          </div>

          {/* Social / Instagram */}
          <div className="rounded-xl border border-charcoal/10 bg-ivory/50 p-4">
            <h3 className="text-sm font-semibold text-charcoal">
              Social / Instagram
            </h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-charcoal-muted">
                  Eyebrow
                </span>
                <input
                  type="text"
                  value={homeData.socialEyebrow}
                  onChange={(e) => updateHome("socialEyebrow", e.target.value)}
                  className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-charcoal-muted">
                  Heading
                </span>
                <input
                  type="text"
                  value={homeData.socialHeading}
                  onChange={(e) => updateHome("socialHeading", e.target.value)}
                  className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-charcoal-muted">
                  Description
                </span>
                <input
                  type="text"
                  value={homeData.socialDescription}
                  onChange={(e) =>
                    updateHome("socialDescription", e.target.value)
                  }
                  className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-charcoal-muted">
                  Handle
                </span>
                <input
                  type="text"
                  value={homeData.socialHandle}
                  onChange={(e) => updateHome("socialHandle", e.target.value)}
                  className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                  placeholder="@dinsbydaniyal"
                />
              </label>
            </div>
            <div className="mt-4">
              <span className="mb-2 block text-xs font-medium text-charcoal-muted">
                Gallery Images (6)
              </span>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <ImagePicker
                    key={`social-${index}`}
                    name={`socialImage${index}`}
                    value={homeData.socialImages?.[index] || ""}
                    folder="cms/social"
                    label={`Image ${index + 1}`}
                    hint={`Social gallery image ${index + 1}`}
                    onChange={(path) => {
                      const newImages = [
                        ...(homeData.socialImages || ["", "", "", "", "", ""]),
                      ];
                      newImages[index] = path;
                      setHomeData((prev) => ({
                        ...prev,
                        socialImages: newImages,
                      }));
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Newsletter */}
          <div className="rounded-xl border border-charcoal/10 bg-ivory/50 p-4">
            <h3 className="text-sm font-semibold text-charcoal">Newsletter</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-charcoal-muted">
                  Eyebrow
                </span>
                <input
                  type="text"
                  value={homeData.newsletterEyebrow}
                  onChange={(e) =>
                    updateHome("newsletterEyebrow", e.target.value)
                  }
                  className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-charcoal-muted">
                  Heading
                </span>
                <input
                  type="text"
                  value={homeData.newsletterHeading}
                  onChange={(e) =>
                    updateHome("newsletterHeading", e.target.value)
                  }
                  className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-charcoal-muted">
                  Description
                </span>
                <input
                  type="text"
                  value={homeData.newsletterDescription}
                  onChange={(e) =>
                    updateHome("newsletterDescription", e.target.value)
                  }
                  className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-charcoal-muted">
                  Button Label
                </span>
                <input
                  type="text"
                  value={homeData.newsletterCtaLabel}
                  onChange={(e) =>
                    updateHome("newsletterCtaLabel", e.target.value)
                  }
                  className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                  placeholder="Subscribe"
                />
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="rounded-xl border border-charcoal/10 bg-ivory/50 p-4">
            <h3 className="text-sm font-semibold text-charcoal">Footer</h3>
            <div className="mt-3 space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-charcoal-muted">
                  About Text
                </span>
                <textarea
                  value={homeData.footerAbout}
                  onChange={(e) => updateHome("footerAbout", e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-charcoal-muted">
                    Copyright
                  </span>
                  <input
                    type="text"
                    value={homeData.footerCopyright}
                    onChange={(e) =>
                      updateHome("footerCopyright", e.target.value)
                    }
                    className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-charcoal-muted">
                    Tagline
                  </span>
                  <input
                    type="text"
                    value={homeData.footerTagline}
                    onChange={(e) =>
                      updateHome("footerTagline", e.target.value)
                    }
                    className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={homePending}
              className="rounded-full bg-plum px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-plum-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {homePending ? "Saving..." : "Save Homepage Content"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
