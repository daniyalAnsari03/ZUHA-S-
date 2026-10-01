import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Server Actions reject any request body over 1 MB by default and answer
      // with a 500 before the action body runs. That silently broke every
      // image upload: the admin upload action advertises and enforces a 5 MB
      // cap, but anything from 1 MB up could never reach it — the client only
      // saw the generic "Upload failed." because the picker catches the
      // rejection. This affects product, category, hero, media-library and
      // AI-chat uploads alike; all of them go through uploadImageAction.
      //
      // 6 MB, not 5 MB: the limit measures the whole multipart body, so a file
      // at exactly the action's 5 MB cap would still be rejected once the
      // boundary and envelope are added. The action's own MAX_FILE_SIZE check
      // remains the real limit and still returns the friendly error message.
      bodySizeLimit: "6mb",
    },
  },
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Only these quality steps may be requested by `next/image`. Product
    // photography is optimised per surface instead of using the 75 default:
    // 50 for card and category thumbnails, 60 for the product detail image, 75
    // wherever nothing claims a lower step, and 90 for the full-bleed
    // homepage slides.
    //
    // 90 on the full-bleed slides is not a preference. Those images are shown
    // edge to edge on a 27-inch display as often as on a phone, and at q55 a
    // photograph that survives the resize visibly loses its weave and its fine
    // embroidery stitching at that size. It is the step that undid the
    // pixelation the upload-side compression used to cause.
    qualities: [50, 55, 60, 75, 90],
    // Candidate widths are what `next/image` may pick from. The 828/1200 steps
    // are kept for full-bleed sections; smaller steps let grid cards,
    // thumbnails and category tiles stop at a 384/512 candidate.
    //
    // 1920 used to be the ceiling, which was itself a cause of the pixelation:
    // a 1440px viewport at 2x DPR needs 2880px and was being handed a 1920px
    // candidate to upscale. 2560 and 3200 close that gap for large and
    // high-density screens; the small steps are untouched, so a phone at 1.75
    // DPR still lands on the 828 candidate and grid cards still stop at 384.
    deviceSizes: [384, 512, 640, 828, 1080, 1200, 1920, 2560, 3200],
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
