import Image from "next/image";

import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { InstagramIcon } from "@/components/ui/social-icons";

const handle = "@dinsbydaniyal";

const tiles = Array.from({ length: 6 }, (_, index) => ({
  src: `/images/placeholders/social-${index + 1}.svg`,
  alt: `${handle} — post placeholder ${index + 1}`,
}));

/**
 * Social / Instagram-style gallery. Phase 2 shows premium local placeholder
 * tiles; live platform integration arrives in a later phase.
 */
export function SocialGallery() {
  return (
    <section
      aria-labelledby="social-gallery-heading"
      className="bg-white py-16 sm:py-24"
    >
      <Container>
        <Reveal>
          <div className="mb-8 text-center">
            <p className="text-[11px] uppercase tracking-[0.32em] text-gold-muted">
              On Instagram
            </p>
            <h2
              id="social-gallery-heading"
              className="mt-2 font-serif text-2xl text-charcoal sm:text-3xl"
            >
              Follow {handle}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-charcoal-muted">
              A closer look at the studio, the craft and the collection.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">
          {tiles.map((tile, index) => (
            <Reveal key={tile.src} delay={index * 0.05}>
              <div className="group relative overflow-hidden rounded-2xl bg-cream">
                <Image
                  src={tile.src}
                  alt={tile.alt}
                  width={800}
                  height={800}
                  sizes="(min-width: 640px) 30vw, 45vw"
                  loading="lazy"
                  className="aspect-square h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 flex items-center justify-center bg-plum-dark/0 text-white opacity-0 transition-all duration-300 group-hover:bg-plum-dark/45 group-hover:opacity-100"
                >
                  <InstagramIcon className="h-7 w-7" />
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}