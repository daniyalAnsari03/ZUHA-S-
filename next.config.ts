import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Phase 2 storefront artwork uses local SVG placeholders (brand-safe,
    // theme-consistent). These will be replaced by optimized photography in
    // later phases; the SVG allowance is scoped to the local placeholders.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
