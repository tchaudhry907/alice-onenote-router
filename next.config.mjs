// next.config.js
// Force any '@vercel/kv' import to use our local '@/lib/kv' wrapper.
// This eliminates build failures even if a stray file (or cache) still imports '@vercel/kv'.

const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@vercel/kv": path.resolve(__dirname, "lib/kv.js"),
    };
    return config;
  },
};

module.exports = nextConfig;
