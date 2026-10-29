import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  // Allow dev assets/HMR to be served through the preview gateway & local IPs
  allowedDevOrigins: ["127.0.0.1", "http://127.0.0.1", "http://localhost", "http://21.0.10.169"],
};

export default nextConfig;
