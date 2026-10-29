import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Default to "standalone" for the .exe / dev server.
  // The GitHub Actions workflow for APK and Web temporarily overrides this
  // to "export" before running `next build`.
  output: "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  // Allow dev assets/HMR to be served through the preview gateway & local IPs
  allowedDevOrigins: [
    "127.0.0.1",
    "http://127.0.0.1",
    "http://localhost",
    "http://21.0.10.169",
    "*.space-z.ai",
    "https://*.space-z.ai",
    "http://*.space-z.ai",
  ],
  pageExtensions: ["tsx", "ts", "jsx", "js"],
  // Allow importing code from outside src/ (e.g. shared utilities).
  experimental: {
    externalDir: true,
  },
  // Required for `next/image` to work in static export mode —
  // the optimizer needs a Node.js server, so in export mode we serve
  // the original images directly.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
