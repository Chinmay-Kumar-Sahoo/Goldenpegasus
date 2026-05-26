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

  // Ensure cookies are properly handled for authentication
  headers: async () => {
    return [
      {
        source: "/auth/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
