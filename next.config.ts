import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  // Cloudflare Workers do not provide Next's default image optimizer.
  // Public assets and optimized uploads are served directly by the Worker.
  images: { unoptimized: true },
  // Allow dev assets/HMR to be served through the preview gateway & local IPs
  allowedDevOrigins: [
    "127.0.0.1",
    "http://127.0.0.1",
    "http://localhost",
    "http://21.0.10.169",
    "*.space-z.ai",
    "https://*.space-z.ai",
  ],
  // Default output remains Node.js/Electron standalone. Cloudflare Workers
  // uses the explicit `cloudflare:*` scripts and open-next.config.ts adapter.
};

export default nextConfig;
