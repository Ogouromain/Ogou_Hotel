import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // ─── Performance Optimizations for Côte d'Ivoire Mobile Networks ──────────
  // These optimizations target slow 3G/4G connections and low-end devices
  // common in Côte d'Ivoire's mobile-first market.

  reactStrictMode: false,

  // ─── Image Optimization ───────────────────────────────────────────────────
  // Configure image domains and optimization for fast loading on mobile
  images: {
    // Unoptimized for standalone output; use next/image with explicit sizes
    unoptimized: true,
    // Allowed domains for external images
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'rjgiktswlgfokztwuqup.supabase.co',
      },
    ],
  },

  // ─── Turbopack Config (Next.js 16 default) ────────────────────────────────
  // Empty config to acknowledge Turbopack is in use and silence the warning.
  // Webpack-specific splitChunks config is NOT compatible with Turbopack.
  turbopack: {},

  // ─── Headers for Performance & Security ───────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Security headers
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      {
        // Static assets: aggressive cache (1 year with immutable)
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // HTML pages: must revalidate
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ]
  },

  // ─── TypeScript ───────────────────────────────────────────────────────────
  typescript: {
    ignoreBuildErrors: true,
  },

  // ─── Allowed Dev Origins ──────────────────────────────────────────────────
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '.space-z.ai',
  ],
};

export default nextConfig;
