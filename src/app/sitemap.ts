import type { MetadataRoute } from "next";
import { buildSitemap } from "@/lib/seo/site-discovery";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemap();
}
