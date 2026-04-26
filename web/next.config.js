/** @type {import('next').NextConfig} */

// GitHub Pages serves the site under /<repo-name>/. We default to /tamar-stickers
// in production builds so absolute asset URLs (manifest, icons, _next/*) resolve
// correctly. Override with NEXT_PUBLIC_BASE_PATH (e.g. "" for a custom domain).
const isProd = process.env.NODE_ENV === "production";
const rawBasePath =
  process.env.NEXT_PUBLIC_BASE_PATH ?? (isProd ? "/tamar-stickers" : "");
const basePath = rawBasePath === "/" ? "" : rawBasePath;

const nextConfig = {
  reactStrictMode: true,
  // Static HTML export — required for GitHub Pages (no Node server runs there).
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

module.exports = nextConfig;
