import Image from "next/image";

import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { resolveImageUrl } from "@/lib/images";
import { getHomepageContent } from "@/services/cms/cms-service";

/**
 * Brand Story — editorial, concise and factual. Copy deliberately avoids
 * invented claims (years, awards, endorsements). Reads from CMS when available.
 */
export async function BrandStory() {
  let content: Record<string, string> = {};
  try {
    const raw = await getHomepageContent();
    content = raw as Record<string, string>;
  } catch {
    // Use defaults
  }

  const heading =
    content.brandStoryHeading ||
    "Craftsmanship that carries heritage into the modern wardrobe.";
  const body =
    content.brandStoryBody ||
    "dINS by Daniyal is a Pakistani fashion label centred on considered detail — hand-finished embroidery, woven jamawar and unstitched collections made to be worn and kept.\n\nEach piece begins with fabric and technique; the result is design that feels at once familiar and new. We care less about seasons and more about garments you reach for again.";
  const cta = content.brandStoryCta || "Designed and finished in Pakistan.";
  const image =
    resolveImageUrl(content.brandStoryImage) ||
    "/images/placeholders/product-3.svg";

  const bodyParagraphs = body.split("\n").filter((p) => p.trim());

  return (
    <section
      id="brand-story"
      aria-labelledby="brand-story-heading"
      className="border-t border-charcoal/10 bg-ivory py-16 sm:py-24"
    >
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl bg-cream shadow-[0_16px_44px_-26px_rgba(43,38,34,0.5)]">
              <Image
                src={image}
                alt=""
                width={900}
                height={1080}
                sizes="(min-width: 1024px) 45vw, 100vw"
                loading="lazy"
                className="aspect-[5/6] h-full w-full object-cover"
              />
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="text-[11px] uppercase tracking-[0.32em] text-gold-muted">
              Our Story
            </p>
            <h2
              id="brand-story-heading"
              className="mt-3 font-serif text-2xl leading-snug text-charcoal sm:text-3xl"
            >
              {heading}
            </h2>
            <div className="mt-5 space-y-4 text-sm leading-relaxed text-charcoal-muted sm:text-base">
              {bodyParagraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <p className="mt-6 border-t border-charcoal/10 pt-5 font-serif text-sm italic text-plum">
              {cta}
            </p>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}