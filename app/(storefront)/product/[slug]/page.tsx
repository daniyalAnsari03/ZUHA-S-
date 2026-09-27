import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/ui/container";
import { ProductOrderControls } from "@/components/storefront/product-order-controls";
import { ProductPrice } from "@/components/storefront/product-price";
import { WishlistButton } from "@/components/storefront/wishlist-button";
import { getAuthUser } from "@/lib/auth/session";
import { resolveImageUrl } from "@/lib/images";
import { categoryHref } from "@/lib/storefront/format";
import { getProductBySlug } from "@/lib/storefront/data";
import { isProductWishlisted } from "@/services/wishlist/wishlist-service";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product Not Found" };

  return {
    title: product.name,
    description:
      product.description ||
      `${product.name} — premium Pakistani fashion by DINS by Daniyal.`,
    openGraph: {
      type: "website",
      title: product.name,
      description: product.description ?? undefined,
      images: resolveImageUrl(product.image)
        ? [{ url: resolveImageUrl(product.image)!, alt: product.name }]
        : [],
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;

  const [product, user] = await Promise.all([
    getProductBySlug(slug),
    getAuthUser(),
  ]);

  if (!product) notFound();

  const inStockStatus = product.stockQuantity > 0 ? "In Stock" : "Out of Stock";

  const initialWishlisted = user
    ? await isProductWishlisted(user.id, product.id).catch(() => false)
    : false;

  return (
    <main className="flex-1 bg-white">
      <Container size="lg" className="py-8 sm:py-14">
        <p className="text-[11px] uppercase tracking-[0.32em] text-gold-muted">
          <Link href="/" className="transition-colors hover:text-plum">
            Home
          </Link>{" "}
          /{" "}
          <Link href="/shop" className="transition-colors hover:text-plum">
            Shop
          </Link>
          {product.categorySlug ? (
            <>
              {" "}
              /{" "}
              <Link
                href={categoryHref(product.categorySlug)}
                className="transition-colors hover:text-plum"
              >
                {product.categorySlug.charAt(0).toUpperCase() +
                  product.categorySlug.slice(1).replace(/-/g, " ")}
              </Link>
            </>
          ) : null}
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-2 lg:gap-14">
          {/* Product Image */}
          <div className="relative overflow-hidden rounded-2xl border border-charcoal/10 bg-cream">
            <div className="relative aspect-[4/5] w-full overflow-hidden">
              <Image
                src={
                  resolveImageUrl(product.image) ||
                  "/images/placeholders/product-placeholder.svg"
                }
                alt={product.name}
                width={1200}
                height={1500}
                sizes="(min-width: 1024px) 50vw, 100vw"
                priority
                // This single image was 222KB of the page's 571KB mobile total
                // (w=828 at the default quality 75), so it alone kept the PDP's
                // LCP flat while every other page improved. The source photos are
                // phone-camera JPEGs rendered at ~380px wide on a phone, where
                // quality 60 is visually indistinguishable and materially smaller.
                quality={60}
                className="h-full w-full object-cover"
              />
            </div>
            {product.label ? (
              <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-plum">
                {product.label}
              </span>
            ) : null}
          </div>

          {/* Product Info */}
          <div className="flex flex-col justify-start gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-gold-muted">
                DINS by Daniyal
              </p>
              <h1 className="mt-2 font-serif text-2xl leading-tight text-charcoal sm:text-3xl lg:text-4xl">
                {product.name}
              </h1>
            </div>

            <ProductPrice
              product={product}
              className="text-lg font-medium text-charcoal"
            />

            {/* Details */}
            <div className="flex flex-col gap-2 text-sm text-charcoal-muted">
              {product.fabric ? (
                <p>
                  <span className="font-medium text-charcoal">Fabric:</span>{" "}
                  {product.fabric}
                </p>
              ) : null}
              {product.embroidery ? (
                <p>
                  <span className="font-medium text-charcoal">Embroidery:</span>{" "}
                  {product.embroidery}
                </p>
              ) : null}
              {product.color ? (
                <p>
                  <span className="font-medium text-charcoal">Color:</span>{" "}
                  {product.color}
                </p>
              ) : null}
            </div>

            {/* Stock Status */}
            <p className="text-sm font-medium text-charcoal-muted">
              Availability:{" "}
              <span
                className={
                  product.stockQuantity > 0 ? "text-green-700" : "text-red-600"
                }
              >
                {inStockStatus}
              </span>
              {product.stockQuantity > 0 &&
              product.stockQuantity <= product.lowStockThreshold
                ? ` — Only ${product.stockQuantity} left`
                : null}
            </p>

            {/* Description */}
            {product.description ? (
              <div className="mt-2 border-t border-charcoal/10 pt-6">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-charcoal">
                  Description
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-charcoal-muted">
                  {product.description}
                </p>
              </div>
            ) : null}

            {/* Order controls */}
            <div className="mt-2 border-t border-charcoal/10 pt-6">
              <div className="flex items-start justify-between gap-4">
                <ProductOrderControls
                  productId={product.id}
                  stock={product.stockQuantity}
                  disabled={product.stockQuantity <= 0}
                  className="flex-1"
                />
                <WishlistButton
                  productId={product.id}
                  initialSaved={initialWishlisted}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </main>
  );
}
