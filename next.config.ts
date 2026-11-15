import type { NextConfig } from "next";

// Project site: https://darkmodder33.github.io/tradehax-intel/
const pagesBase = "/tradehax-intel";

const nextConfig: NextConfig = {
  output: "export",
  basePath: pagesBase,
  assetPrefix: pagesBase,
  images: { unoptimized: true },
  trailingSlash: true,
  // The dev server is opened at 127.0.0.1. Next blocks dev assets from
  // any host other than the one it bound as localhost unless this is set.
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
