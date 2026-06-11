import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/articles",
        "/developers",
        "/discover",
        "/login",
        "/operators",
        "/provider",
        "/providers",
        "/senior-care",
        "/senior-living",
        "/seniors",
        "/workbench"
      ]
    },
    sitemap: "https://theseniorguru.com/sitemap.xml"
  };
}
