// next.config.mjs
// Force any import of '@vercel/kv' to resolve to our local stub.

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@vercel/kv": path.resolve(__dirname, "lib/kv-stub.js"),
    };
    return config;
  },
};

export default nextConfig;
