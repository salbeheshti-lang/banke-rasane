import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // For Cloudflare Pages deployment, we'll keep standalone mode
  // The API routes will be handled by the Worker
};

export default nextConfig;
