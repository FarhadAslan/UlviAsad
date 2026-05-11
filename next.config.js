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
    serverActionsBodySizeLimit: "20mb",
  },
  transpilePackages: ["three"],
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["error", "warn"] }
      : false,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // pdf-parse test fayllarını bundle-a daxil etmə
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push("canvas");
      }
    }
    // pdfjs-dist canvas modulunu ignore et
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
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
