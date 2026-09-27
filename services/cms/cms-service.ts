import { revalidateTag } from "next/cache";

import type { Role } from "@/lib/auth/roles";
import {
  createClient as createSupabaseClient,
  createPublicClient,
} from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/types";
import { STORE_CACHE_PROFILE, STORE_CACHE_TAGS } from "@/lib/storefront/cache";
import { assertRole, ServiceError } from "@/services/base";

type SiteContentRow = Database["public"]["Tables"]["site_content"]["Row"];

/**
 * CMS service.
 *
 * Reads are served through the public client (anon role, RLS allows public
 * read). Mutations require an authorized admin actor.
 */

/* ---------------------------------------------------------------------------
 * Reads
 * --------------------------------------------------------------------- */

export async function getCmsContent(key: string): Promise<unknown | null> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("site_content")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    throw new ServiceError("CMS_READ_FAILED", `Failed to load content: ${key}`);
  }

  return data?.value ?? null;
}

export async function getCmsContentById(
  id: string,
): Promise<SiteContentRow | null> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("site_content")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new ServiceError("CMS_READ_FAILED", "Failed to load CMS content.");
  }

  return data;
}

export async function getAllCmsContent(): Promise<SiteContentRow[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("site_content")
    .select("*")
    .order("key");

  if (error) {
    throw new ServiceError("CMS_READ_FAILED", "Failed to load CMS content.");
  }

  return data;
}

/* ---------------------------------------------------------------------------
 * Mutations (admin only)
 * --------------------------------------------------------------------- */

type AdminActor = { id: string; role: Role };

export async function upsertCmsContent(
  actor: AdminActor,
  key: string,
  value: Record<string, unknown>,
): Promise<SiteContentRow> {
  assertRole(actor.role, ["admin"]);

  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("site_content")
    .upsert({ key, value: value as Json }, { onConflict: "key" })
    .select("*")
    .single();

  if (error) {
    throw new ServiceError(
      "CMS_WRITE_FAILED",
      `Failed to save content: ${key}`,
    );
  }

  revalidateTag(STORE_CACHE_TAGS.cms, STORE_CACHE_PROFILE);

  return data;
}

export async function deleteCmsContent(
  actor: AdminActor,
  key: string,
): Promise<void> {
  assertRole(actor.role, ["admin"]);

  const supabase = await createSupabaseClient();

  const { error } = await supabase.from("site_content").delete().eq("key", key);

  if (error) {
    throw new ServiceError(
      "CMS_DELETE_FAILED",
      `Failed to delete content: ${key}`,
    );
  }

  revalidateTag(STORE_CACHE_TAGS.cms, STORE_CACHE_PROFILE);
}

/* ---------------------------------------------------------------------------
 * Convenience helpers for specific content types
 * --------------------------------------------------------------------- */

export type AnnouncementItem = {
  id: string;
  message: string;
  href?: string;
  active: boolean;
  order: number;
  durationMs: number;
};

export type HeroSlideData = {
  id: string;
  image: string;
  eyebrow?: string;
  heading: string;
  paragraph: string;
  ctaLabel: string;
  ctaHref: string;
  active: boolean;
  order: number;
};

export type HomepageContent = {
  shopByCategoryHeading?: string;
  shopByCategoryEyebrow?: string;
  brandStoryHeading?: string;
  brandStoryBody?: string;
  brandStoryCta?: string;
  brandStoryImage?: string;
  socialHeading?: string;
  socialEyebrow?: string;
  socialDescription?: string;
  socialHandle?: string;
  socialImages?: string[];
  newsletterHeading?: string;
  newsletterEyebrow?: string;
  newsletterDescription?: string;
  newsletterCtaLabel?: string;
  footerAbout?: string;
  footerCopyright?: string;
  footerTagline?: string;
};

export async function getAnnouncements(): Promise<AnnouncementItem[]> {
  const raw = await getCmsContent("announcements");
  if (!Array.isArray(raw)) return [];
  return raw as AnnouncementItem[];
}

export async function getHeroSlide(): Promise<HeroSlideData | null> {
  const raw = await getCmsContent("hero");
  if (!raw || typeof raw !== "object") return null;
  return raw as HeroSlideData;
}

export async function getHomepageContent(): Promise<HomepageContent> {
  const raw = await getCmsContent("homepage");
  if (!raw || typeof raw !== "object") return {};
  return raw as HomepageContent;
}
