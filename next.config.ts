import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow dev assets/HMR to be served through the preview gateway & local IPs
  allowedDevOrigins: ["127.0.0.1", "http://127.0.0.1", "http://localhost", "http://21.0.10.169"],
  // For Cloudflare Pages deployment, we'll keep standalone mode
  // The API routes will be handled by the Worker
};

export default nextConfig;
