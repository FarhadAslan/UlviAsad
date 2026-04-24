/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["lh3.googleusercontent.com", "avatars.githubusercontent.com"],
  },
  experimental: {
    serverActions: true,
  },
  transpilePackages: ["three"],
  api: {
    bodyParser: { sizeLimit: "50mb" },
    responseLimit: "50mb",
  },
  // Statik səhifələri aggressiv cache et
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
};

module.exports = nextConfig;
