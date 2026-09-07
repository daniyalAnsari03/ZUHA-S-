import Image from "next/image";
import Link from "next/link";

import { categoryHref } from "@/lib/storefront/format";
import type { Category } from "@/lib/storefront/types";

type CategoryCardProps = {
  category: Category;
};

/**
 * Image-led category card used in the overlapping Shop By Category section.
 */
export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Link
      href={categoryHref(category.slug)}
      className="group relative block overflow-hidden rounded-2xl border border-white/40 bg-cream shadow-[0_10px_30px_-18px_rgba(43,38,34,0.45)] transition-shadow duration-300 hover:shadow-[0_16px_40px_-20px_rgba(43,38,34,0.55)] focus-visible:outline-plum"
    >
      <div className="aspect-[4/5] overflow-hidden">
        <Image
          src={category.image}
          alt={category.name}
          width={800}
          height={1000}
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-charcoal/75 via-charcoal/35 to-transparent px-4 pb-4 pt-14 sm:px-5 sm:pb-5">
        <h3 className="font-serif text-base text-white sm:text-lg">{category.name}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/75">
          {category.description}
        </p>
      </div>
    </Link>
  );
}