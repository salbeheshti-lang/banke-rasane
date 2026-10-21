/** @type {import('next').NextConfig} */
const nextConfig = {
  // Must use webpack (not Turbopack) — Turbopack is unstable on large page.tsx files
  reactStrictMode: false,
  swcMinify: true,
  // Server output for Electron integration (supports API routes)
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  // Disable type checking on build (handled separately)
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    // Handle native modules for prisma
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    // Exclude prisma engine binaries from client bundle
    if (isServer) {
      config.externals = config.externals || [];
    }
    return config;
  },
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma']
  }
};

module.exports = nextConfig;
