import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // ─── Performance Optimizations for Côte d'Ivoire Mobile Networks ──────────
  // These optimizations target slow 3G/4G connections and low-end devices
  // common in Côte d'Ivoire's mobile-first market.

  reactStrictMode: false,

  // ─── Compression ───────────────────────────────────────────────────────────
  // Enable gzip/brotli compression for all responses.
  // Vercel and most CDNs handle this automatically in production,
  // but we declare it for self-hosted standalone deployments.
  compress: true,

  // ─── Image Optimization ───────────────────────────────────────────────────
  // Configure image domains and optimization for fast loading on mobile.
  // For standalone output, we use unoptimized: true but with WebP awareness.
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
    // Prefer WebP format hints for lighter images on mobile
    formats: ['image/webp', 'image/avif'],
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
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // Content Security Policy — allows Supabase, Vercel analytics
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://rjgiktswlgfokztwuqup.supabase.co",
              "connect-src 'self' https://rjgiktswlgfokztwuqup.supabase.co wss://rjgiktswlgfokztwuqup.supabase.co",
              "font-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
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
        // Font files: cache for 1 year
        source: '/(.*)\\.(woff|woff2|ttf|otf|eot)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Image files: cache for 30 days
        source: '/(.*)\\.(jpg|jpeg|png|gif|webp|avif|svg|ico)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=2592000, stale-while-revalidate=86400',
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
      {
        // API routes: no cache (always fresh data)
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
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
