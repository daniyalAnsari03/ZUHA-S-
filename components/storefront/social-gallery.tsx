import Image from "next/image";

import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { InstagramIcon } from "@/components/ui/social-icons";
import { resolveImageUrl } from "@/lib/images";
import { getHomepageContent } from "@/services/cms/cms-service";

const FALLBACK_HANDLE = "@dinsbydaniyal";
const FALLBACK_TILES = Array.from({ length: 6 }, (_, index) => ({
  src: `/images/placeholders/social-${index + 1}.svg`,
  alt: `${FALLBACK_HANDLE} — post placeholder ${index + 1}`,
}));

/**
 * Social / Instagram-style gallery. Reads from CMS when available.
 */
export async function SocialGallery() {
  let handle = FALLBACK_HANDLE;
  let heading = `Follow ${FALLBACK_HANDLE}`;
  let eyebrow = "On Instagram";
  let description =
    "A closer look at the studio, the craft and the collection.";
  let tiles = FALLBACK_TILES;

  try {
    const content = await getHomepageContent();
    if (content.socialHandle) handle = content.socialHandle;
    if (content.socialHeading) heading = content.socialHeading;
    if (content.socialEyebrow) eyebrow = content.socialEyebrow;
    if (content.socialDescription) description = content.socialDescription;
    if (content.socialImages && content.socialImages.length > 0) {
      tiles = content.socialImages
        .map((src) => resolveImageUrl(src))
        .filter((src): src is string => src !== null)
        .map((src, index) => ({
          src,
          alt: `${handle} — post ${index + 1}`,
        }));
    }
  } catch {
    // Use defaults
  }

  return (
    <section
      aria-labelledby="social-gallery-heading"
      className="bg-white py-16 sm:py-24"
    >
      <Container>
        <Reveal>
          <div className="mb-8 text-center">
            <p className="text-[11px] uppercase tracking-[0.32em] text-gold-muted">
              {eyebrow}
            </p>
            <h2
              id="social-gallery-heading"
              className="mt-2 font-serif text-2xl text-charcoal sm:text-3xl"
            >
              {heading}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-charcoal-muted">
              {description}
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
