-- CMS content table for admin-controlled storefront content.
-- Stores key-value pairs where the value is JSONB, allowing flexible
-- content structures for announcements, hero slides, homepage text, etc.

CREATE TABLE IF NOT EXISTS public.site_content (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text NOT NULL UNIQUE,
  value      jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.site_content IS 'Admin-controlled CMS content for the storefront. Each row stores a named content block as JSONB.';

CREATE INDEX IF NOT EXISTS idx_site_content_key ON public.site_content (key);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_site_content_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_site_content_updated_at ON public.site_content;
CREATE TRIGGER trg_site_content_updated_at
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW
  EXECUTE FUNCTION public.set_site_content_updated_at();

-- RLS
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

-- Public read for active content (storefront needs to read)
CREATE POLICY "Public can read site_content"
  ON public.site_content
  FOR SELECT
  USING (true);

-- Admin full access
CREATE POLICY "Admins can manage site_content"
  ON public.site_content
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Grants
GRANT SELECT ON public.site_content TO anon;
GRANT ALL ON public.site_content TO authenticated;

-- Seed default CMS content
INSERT INTO public.site_content (key, value) VALUES
  ('announcements', '[
    {"id":"announcement-1","message":"Complimentary shipping on orders over PKR 15,000","href":"","active":true,"order":1,"durationMs":5000},
    {"id":"announcement-2","message":"New arrivals — Jamawar & Cut-Dana embroidery now online","href":"","active":true,"order":2,"durationMs":5000},
    {"id":"announcement-3","message":"Subscribe for early access to the seasonal collection","href":"","active":true,"order":3,"durationMs":5000}
  ]'),
  ('hero', '{
    "id":"hero-1",
    "image":"/images/placeholders/hero.svg",
    "eyebrow":"Jamawar · Embroidery · Lawn",
    "heading":"Where Pakistani craftsmanship meets modern elegance.",
    "paragraph":"Hand-finished embroidery, heritage jamawar and feather-light lawn — designed for the way you live.",
    "ctaLabel":"Shop the Collection",
    "ctaHref":"/shop",
    "active":true,
    "order":1
  }'),
  ('homepage', '{
    "shopByCategoryHeading":"Shop by Category",
    "shopByCategoryEyebrow":"Curated for you",
    "brandStoryHeading":"Craftsmanship that carries heritage into the modern wardrobe.",
    "brandStoryBody":"dINS by Daniyal is a Pakistani fashion label centred on considered detail — hand-finished embroidery, woven jamawar and unstitched collections made to be worn and kept.\n\nEach piece begins with fabric and technique; the result is design that feels at once familiar and new. We care less about seasons and more about garments you reach for again.",
    "brandStoryCta":"Designed and finished in Pakistan.",
    "brandStoryImage":"/images/placeholders/product-3.svg",
    "socialHeading":"Follow @dinsbydaniyal",
    "socialEyebrow":"On Instagram",
    "socialDescription":"A closer look at the studio, the craft and the collection.",
    "socialHandle":"@dinsbydaniyal",
    "socialImages":["/images/placeholders/social-1.svg","/images/placeholders/social-2.svg","/images/placeholders/social-3.svg","/images/placeholders/social-4.svg","/images/placeholders/social-5.svg","/images/placeholders/social-6.svg"],
    "newsletterHeading":"Early access to new collections",
    "newsletterEyebrow":"Join the list",
    "newsletterDescription":"Be the first to know about fresh drops, limited pieces and private previews.",
    "newsletterCtaLabel":"Subscribe",
    "footerAbout":"A Pakistani fashion label for considered craftsmanship — embroidery, jamawar, lawn and unstitched collections.",
    "footerCopyright":"All rights reserved.",
    "footerTagline":"Made with care in Pakistan."
  }')
ON CONFLICT (key) DO NOTHING;
