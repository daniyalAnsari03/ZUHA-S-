import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "";

const nextConfig: NextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Only these quality steps may be requested by `next/image`. Product
    // photography is optimised per surface instead of using the 75 default:
    // 50 for card and category thumbnails, 55 for the full-bleed hero, 60 for
    // the product detail image. On a 412px phone at 1.75 DPR the smaller
    // candidate widths below keep a card image on the 384/512 step rather than
    // the 828 step, which is where most of the storefront image weight used to
    // come from.
    qualities: [50, 55, 60, 75],
    // Candidate widths are what `next/image` may pick from. The 828/1200/1920
    // steps are kept for the hero and full-bleed sections; smaller steps let
    // grid cards, thumbnails and category tiles stop at a 384/512 candidate.
    deviceSizes: [384, 512, 640, 828, 1080, 1200, 1920],
    imageSizes: [64, 96, 128, 192, 256, 384, 512],
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  async headers() {
    return [
      {
        // Public storefront documents are rendered dynamically (category
        // filters come from `searchParams`, the product page renders the
        // signed-in wishlist state), so Next.js answers them with
        // `Cache-Control: private, no-cache, no-store, max-age=0`.
        //
        // `no-store` is a hard back/forward-cache (bfcache) disqualifier in
        // Chrome: it was measured blocking back-navigation entirely (44
        // requests and a full re-render going back to /shop, 35 for a product
        // page, versus 1 request for the statically rendered homepage). It
        // also buys nothing here, because these documents are per-visitor
        // anyway: `private` already keeps them out of every shared cache and
        // `no-cache` + `must-revalidate` still forces a revalidation on any
        // normal load, so no stale price or stock can ever be shown.
        //
        // Dropping `no-store` makes back/forward navigation instant while
        // keeping the documents browser-private and always revalidated.
        // Authenticated control surfaces (/admin, /account, /orders,
        // /checkout, /cart, /wishlist) are deliberately left with the default
        // `no-store`.
        source: "/:path((?!admin|account|orders|checkout|cart|wishlist|login|signup|auth|api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|images).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
