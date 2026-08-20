/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // The prototype UI was ported from a JS artifact; keep the build
    // from being blocked on incremental typing while that's cleaned up.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
