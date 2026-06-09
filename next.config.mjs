/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      }
    ]
  },
  async rewrites() {
    return [
      // Route api.theseniorguru.com/integrations/* → /api/integrations/*
      // Requires api.theseniorguru.com to be added as an alias domain in Vercel
      {
        source: "/integrations/:path*",
        has: [{ type: "host", value: "api.theseniorguru.com" }],
        destination: "/api/integrations/:path*"
      }
    ];
  }
};

export default nextConfig;
