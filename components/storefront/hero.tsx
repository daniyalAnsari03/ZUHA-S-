import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { resolveImageUrl } from "@/lib/images";
import type { HeroSlide } from "@/lib/storefront/types";

type HeroProps = {
  slide: HeroSlide;
};

/**
 * Large, image-led luxury hero. Admin-controllable fields (image, heading,
 * paragraph, CTA, ordering) map directly to the slide record.
 *
 * The hero is the first slide of `HomeSlides`, which owns the slide height and
 * the offset that pulls the stack up under the sticky navbar, so the section
 * itself only has to fill the slide it is given.
 */
export function Hero({ slide }: HeroProps) {
  return (
    <section className="relative z-0 h-full overflow-hidden bg-plum-dark">
      <div className="absolute inset-0">
        {resolveImageUrl(slide.image) ? (
          <Image
            src={resolveImageUrl(slide.image)!}
            alt=""
            fill
            sizes="100vw"
            // The hero is the LCP element on the homepage. `priority` injects
            // the preload link; the explicit fetchPriority is what makes the
            // image itself outrank every other request during load.
            priority
            fetchPriority="high"
            // Full-bleed, full viewport height, and the first thing anyone sees.
            // It used to be served at 55 on the argument that the gradient scrim
            // above it hides the difference — it does not: on a 27-inch display
            // the photograph is being shown at roughly 2x this site's thumbnail
            // budget, and the weave in the fabric is plainly soft at 55. 90 is
            // the step the category slides use for the same reason, and
            // `sizes="100vw"` keeps the phone download at the 828px candidate.
            quality={90}
            className="object-cover object-center"
          />
        ) : (
          <div className="absolute inset-0 bg-plum-dark" />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-charcoal/30 via-transparent to-charcoal/55"
        />
      </div>

      <div className="relative h-full">
        <Container className="flex min-h-full flex-col items-center justify-end pb-28 pt-24 text-center sm:pb-32 sm:pt-32">
          <div className="flex max-w-2xl flex-col items-center">
            {slide.eyebrow ? (
              <p className="text-[11px] uppercase tracking-[0.32em] text-gold-soft sm:text-xs">
                {slide.eyebrow}
              </p>
            ) : null}
            <h1 className="mt-4 font-serif text-3xl leading-tight text-white sm:text-5xl lg:text-6xl">
              {slide.heading}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
              {slide.paragraph}
            </p>
            <Link href={slide.ctaHref} className="mt-8">
              <Button size="lg">{slide.ctaLabel}</Button>
            </Link>
          </div>
        </Container>
      </div>
    </section>
  );
}
