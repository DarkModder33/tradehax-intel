// Unset or empty serves https://tradehaxai.tech from /. Set NEXT_PUBLIC_BASE_PATH only for a project-site prefix.
const rawBase = process.env.NEXT_PUBLIC_BASE_PATH;
const pagesBase = rawBase == null || rawBase === "" || rawBase === "/" ? "" : rawBase.replace(/\/+$/, "");
const prefix = pagesBase === "" ? "" : pagesBase.startsWith("/") ? pagesBase : `/${pagesBase}`;

const nextConfig = {
  output: "export",
  basePath: prefix,
  assetPrefix: prefix,
  images: { unoptimized: true },
  trailingSlash: true,
  // The dev server is opened at 127.0.0.1. Next blocks dev assets from
  // any host other than the one it bound as localhost unless this is set.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
