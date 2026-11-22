import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  // Cloudflare Workers does not provide the default Next.js image optimizer.
  // Serve local public assets (including the organization logo) directly.
  images: {
    unoptimized: true,
  },
  // Allow dev assets/HMR to be served through the preview gateway & local IPs
  allowedDevOrigins: [
    "127.0.0.1",
    "http://127.0.0.1",
    "http://localhost",
    "http://21.0.10.169",
    "*.space-z.ai",
    "https://*.space-z.ai",
  ],
  // For Cloudflare Pages deployment, we'll keep standalone mode
  // The API routes will be handled by the Worker
};

export default nextConfig;
