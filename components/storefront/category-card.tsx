import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { resolveImageUrl } from "@/lib/images";
import { categoryHref } from "@/lib/storefront/format";
import type { Category } from "@/lib/storefront/types";

type CategoryCardProps = {
  category: Category;
};

/**
 * Premium editorial category card used in the overlapping Shop By Category
 * section. Uses the same dark-plum scrim + gold-soft accent language as the
 * product cards, with a delicate inner gold frame and a "Shop Now" reveal on
 * hover for a refined luxury feel.
 */
export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Link
      href={categoryHref(category.slug)}
      className="group relative block overflow-hidden rounded-[1.5rem] bg-cream shadow-[0_16px_40px_-24px_rgba(74,32,64,0.4)] transition-all duration-500 hover:shadow-[0_24px_60px_-28px_rgba(74,32,64,0.6)] focus-visible:outline-plum"
    >
      <div className="aspect-[4/5] overflow-hidden lg:aspect-[5/6]">
        <Image
          src={resolveImageUrl(category.image) || "/images/placeholders/category-placeholder.svg"}
          alt={category.name}
          width={800}
          height={1000}
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
          className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]"
        />
      </div>

      

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[75%] bg-gradient-to-t from-plum-dark/95 via-plum-dark/45 to-transparent transition-opacity duration-500" />

      <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-4 pt-16 max-sm:px-3.5 max-sm:pb-3.5">
        <p className="text-[10px] uppercase tracking-[0.32em] text-gold-soft max-sm:text-[9px] max-sm:tracking-[0.26em]">
          Explore
        </p>
        <span className="mt-1.5 block h-px w-8 bg-gold-soft/90 transition-all duration-500 group-hover:w-14 max-sm:mt-1 max-sm:w-6" />
        <h3 className="mt-2 font-serif text-lg leading-snug text-white transition-colors duration-300 group-hover:text-gold-soft sm:text-xl max-sm:mt-1.5 max-sm:text-base max-sm:leading-tight">
          {category.name}
        </h3>
        {category.description ? (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/70 max-sm:mt-1 max-sm:text-[11px] max-sm:leading-snug">
            {category.description}
          </p>
        ) : null}
        <span className="mt-3 hidden translate-y-1.5 items-center gap-1 text-[11px] font-medium uppercase tracking-[0.22em] text-gold-soft opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100 sm:inline-flex">
          Shop now
          <ArrowUpRight size={13} strokeWidth={1.75} />
        </span>
      </div>
    </Link>
  );
}