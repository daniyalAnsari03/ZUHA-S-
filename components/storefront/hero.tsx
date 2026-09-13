import Image from "next/image";
import Link from "next/link";

import { Reveal } from "@/components/motion/reveal";
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
 */
export function Hero({ slide }: HeroProps) {
  return (
    <section className="relative z-0 -mt-32 overflow-hidden bg-plum-dark sm:-mt-40">
      <div className="absolute inset-0">
        {resolveImageUrl(slide.image) ? (
          <Image
            src={resolveImageUrl(slide.image)!}
            alt=""
            fill
            sizes="100vw"
            priority
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

      <div className="relative">
        <Container className="flex min-h-[70vh] flex-col items-center justify-end pb-28 pt-24 text-center sm:pb-32 sm:pt-32">
          <Reveal className="flex max-w-2xl flex-col items-center">
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
          </Reveal>
        </Container>
      </div>
    </section>
  );
}