/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Authentication & PKCE Configuration */
  async redirects() {
    return [
      // Redirect legacy reset-password calls to auth/verify for proper PKCE handling
      {
        source: "/reset-password",
        destination: "/auth/verify",
        permanent: false,
        has: [
          {
            type: "query",
            key: "token_hash",
          },
        ],
      },
    ];
  },

  // Performance: caching headers for static assets and API responses
  async headers() {
    return [
      {
        source: "/auth/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
      {
        source: "/:path*.svg",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/:path*.(jpg|jpeg|png|gif|ico|webp|avif)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, stale-while-revalidate=30" },
        ],
      },
    ];
  },

  // Performance: image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};

export default nextConfig;
