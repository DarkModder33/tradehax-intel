// Unset keeps the GitHub project path. An empty NEXT_PUBLIC_BASE_PATH is the domain root.
const rawBase = process.env.NEXT_PUBLIC_BASE_PATH;
const pagesBase =
  rawBase == null ? "/tradehax-intel" : rawBase === "" || rawBase === "/" ? "" : rawBase.replace(/\/+$/, "");
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
