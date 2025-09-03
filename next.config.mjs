/** @type {import('next').NextConfig} */
const nextConfig = {
  // We are JS-only. If a TS marker sneaks in, don’t fail the build.
  typescript: { ignoreBuildErrors: true },
  // Optional: skip ESLint during build if you want one less moving part.
  // eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
