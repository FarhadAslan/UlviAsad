/** @type {import('next').NextConfig} */
const nextConfig = {
  // CLOUDINARY_CLOUD_NAME-i client-side-a expose et (upload preset üçün lazımdır)
  env: {
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  },
  images: {
    domains: [
      "lh3.googleusercontent.com",
      "avatars.githubusercontent.com",
      "res.cloudinary.com",
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 3600,
  },
  experimental: {
    serverActions: true,
  },
  transpilePackages: ["three"],
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["error", "warn"] }
      : false,
  },
  // Static asset-lər üçün uzunmüddətli cache
  async headers() {
    return [
      {
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/image/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=3600",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
