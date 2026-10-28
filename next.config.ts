import type { NextConfig } from "next";

// Static export for GitHub Pages. NEXT_PUBLIC_BASE_PATH is "/founder-os" on
// https://adityaps70.github.io/founder-os/ and empty for local dev or a custom domain.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
