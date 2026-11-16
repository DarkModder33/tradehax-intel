import type { MetadataRoute } from "next";
import { NAV_HREFS } from "@/lib/nav/model";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return NAV_HREFS.map((href) => ({
    url: `https://tradehaxai.tech${href}`,
    lastModified: new Date("2026-11-16"),
  }));
}
