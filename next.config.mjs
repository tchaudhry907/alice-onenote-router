// next.config.mjs
// ESM config. Aliases '@vercel/kv' -> local 'lib/kv.js' so any stray import resolves.

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
      "@vercel/kv": path.resolve(__dirname, "lib/kv.js"),
    };
    return config;
  },
};

export default nextConfig;
