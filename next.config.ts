import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  // Allow dev assets/HMR to be served through the preview gateway & local IPs
  allowedDevOrigins: [
    "127.0.0.1",
    "http://127.0.0.1",
    "http://localhost",
    "http://21.0.10.169",
    "*.space-z.ai",
    "https://*.space-z.ai",
  ],
  // This standalone output is intended for the Node.js/Electron runtime.
  // Cloudflare Pages is not supported by this config alone: it needs an
  // OpenNext-compatible adapter and a current Worker/API implementation.
};

export default nextConfig;
