import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: ["https://tradehaxai.tech/sitemap.xml", "https://tradehaxai.tech/news-sitemap.xml"],
    host: "https://tradehaxai.tech",
  };
}
